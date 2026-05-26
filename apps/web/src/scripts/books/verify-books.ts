import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import {
  EXPECTED_AUTHORIZED_BOOK_COUNT,
  type BookSamplePlan,
  type BookScanReport,
  type TextSampleReport,
  findRepoRoot,
  getReportPath,
  readJsonFile,
} from "./lib/book-pipeline";
import { getScriptEnv } from "../ingest/lib/script-env";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasForbiddenTextKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenTextKeys);
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(([key, item]) => {
      if (key === "text" || key === "rawText" || key === "cleanedText") {
        return true;
      }
      return hasForbiddenTextKeys(item);
    });
  }

  return false;
}

async function main() {
  const env = getScriptEnv();
  const scan = await readJsonFile<BookScanReport>(
    getReportPath("book-scan-report.json"),
  );
  const samplePlan = await readJsonFile<BookSamplePlan>(
    getReportPath("book-sample-plan.json"),
  );
  const textReport = await readJsonFile<TextSampleReport>(
    getReportPath("book-text-sample-report.json"),
  );

  const migration = await readFile(
    path.join(
      findRepoRoot(),
      "apps",
      "web",
      "supabase",
      "migrations",
      "20260526110000_book_metadata.sql",
    ),
    "utf8",
  );

  assert(
    migration.includes("create table if not exists public.book_metadata"),
    "book_metadata migration is missing.",
  );
  assert(
    migration.includes("authorization_status"),
    "book_metadata authorization_status is missing.",
  );
  assert(
    scan.books.length >= EXPECTED_AUTHORIZED_BOOK_COUNT,
    `Expected at least ${EXPECTED_AUTHORIZED_BOOK_COUNT} authorized local books.`,
  );
  assert(
    samplePlan.books.length === scan.books.length,
    "Sample plan does not cover all scanned local books.",
  );
  assert(
    textReport.books.length === scan.books.length,
    "Text sample report does not cover all scanned local books.",
  );
  assert(
    textReport.text_is_redacted_from_report === true,
    "Text sample report must explicitly redact page text.",
  );
  assert(
    !hasForbiddenTextKeys(textReport),
    "Text sample report must not include extracted page text.",
  );

  for (const book of scan.books) {
    assert(book.file_hash.length === 64, `Missing file hash: ${book.file_name}`);
    assert(
      book.page_count != null && book.page_count > 0,
      `Missing page count: ${book.file_name}`,
    );
    assert(
      book.authorization_status === "user_provided_full_authorization",
      `Book authorization status missing: ${book.file_name}`,
    );

    const sample = samplePlan.books.find(
      (item) => item.file_hash === book.file_hash,
    );
    assert(sample != null, `Missing sample plan: ${book.file_name}`);
    assert(
      sample.sampled_pages.some((page) => page.reason.includes("body")),
      `Sample plan must include body pages: ${book.file_name}`,
    );

    const text = textReport.books.find(
      (item) => item.file_hash === book.file_hash,
    );
    assert(text != null, `Missing text sample report: ${book.file_name}`);
    assert(
      text.body_page_count >= 1,
      `Text sample must include body pages: ${book.file_name}`,
    );
    assert(
      text.page_results.every(
        (page) =>
          page.quality_status !== "pass" ||
          (page.char_count > 0 && page.chinese_ratio > 0),
      ),
      `Passing text pages must have Chinese text stats: ${book.file_name}`,
    );
  }

  const usableBooks = textReport.books.filter((book) => book.text_layer_usable);
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  try {
    const bookDocumentRows = await sql<
      Array<{ document_title: string; source_documents: string; source_chunks: string }>
    >`
      select
        sd.document_title,
        count(distinct sd.id) as source_documents,
        count(sc.id) as source_chunks
      from public.source_documents sd
      left join public.source_chunks sc on sc.source_document_id = sd.id
      where sd.source_type = 'medical_book'
        and sd.license_note = 'user_provided_full_authorization'
      group by sd.document_title
      order by sd.document_title
    `;

    const missingBookTitle = await sql<Array<{ count: string }>>`
      select count(*)::text as count
      from public.source_chunks sc
      join public.source_documents sd on sd.id = sc.source_document_id
      where sd.source_type = 'medical_book'
        and (sc.book_title is null or length(trim(sc.book_title)) = 0)
    `;
    const missingPageOrLocation = await sql<Array<{ count: string }>>`
      select count(*)::text as count
      from public.source_chunks sc
      join public.source_documents sd on sd.id = sc.source_document_id
      where sd.source_type = 'medical_book'
        and sc.page_start is null
        and (sc.location is null or length(trim(sc.location)) = 0)
    `;
    const orphanBookChunks = await sql<Array<{ count: string }>>`
      select count(*)::text as count
      from public.source_chunks sc
      left join public.source_documents sd on sd.id = sc.source_document_id
      where sc.book_title is not null
        and sd.id is null
    `;

    assert(
      Number(missingBookTitle[0]?.count ?? 0) === 0,
      "Some book chunks are missing book_title.",
    );
    assert(
      Number(missingPageOrLocation[0]?.count ?? 0) === 0,
      "Some book chunks are missing page or location.",
    );
    assert(
      Number(orphanBookChunks[0]?.count ?? 0) === 0,
      "Some book chunks are missing source_document_id.",
    );

    console.log(
      JSON.stringify({
        books_verified: scan.books.length,
        book_metadata_migration_present: true,
        scan_report_present: true,
        sample_plan_present: true,
        text_sample_report_present: true,
        full_text_redacted_from_report: true,
        text_layer_usable_books: usableBooks.length,
        all_text_layers_usable: usableBooks.length === scan.books.length,
        database_book_documents: bookDocumentRows,
        missing_book_title_chunks: Number(missingBookTitle[0]?.count ?? 0),
        missing_page_or_location_chunks: Number(
          missingPageOrLocation[0]?.count ?? 0,
        ),
        orphan_book_chunks: Number(orphanBookChunks[0]?.count ?? 0),
      }),
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Book verification failed safely.",
  );
  process.exit(1);
});
