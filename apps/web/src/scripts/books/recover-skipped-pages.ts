import path from "node:path";
import postgres, { type Sql } from "postgres";
import {
  getBookArtifactRoot,
  writeJsonFile,
} from "./lib/book-pipeline";
import { chunkBookPage } from "./lib/text-cleaning";
import { MANUAL_PAGE_SUPPLEMENTS } from "./data/manual-page-supplements";
import { getScriptEnv } from "../ingest/lib/script-env";
import { sha256 } from "../ingest/utils/hash";

function json(sql: Sql, value: unknown) {
  return sql.json((value ?? {}) as never);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function pageText(input: (typeof MANUAL_PAGE_SUPPLEMENTS)[number]) {
  return input.rows
    .map((row) =>
      [
        `类别：${row.category}`,
        `药品名称：${row.medicineName}`,
        `共同点（功效和治疗症状）：${row.commonPoint}`,
        `侧重点（同时出现对应症状时，书中列为优先选用）：${row.emphasis}`,
      ].join("\n"),
    )
    .join("\n\n");
}

async function findBookDocument(sql: Sql, bookTitle: string) {
  const rows = await sql<Array<{ id: string; source_id: string }>>`
    select id, source_id
    from public.source_documents
    where source_type = 'medical_book'
      and document_title = ${bookTitle}
    order by updated_at desc
    limit 1
  `;

  if (!rows[0]) {
    throw new Error(`Book document not found for ${bookTitle}.`);
  }

  return rows[0];
}

async function deleteExistingManualPage(input: {
  sql: Sql;
  sourceDocumentId: string;
  sectionKey: string;
}) {
  await input.sql`
    delete from public.source_chunks
    where source_document_id = ${input.sourceDocumentId}
      and section_key = ${input.sectionKey}
      and metadata->>'manual_recovery' = 'true'
  `;

  await input.sql`
    delete from public.document_sections
    where source_document_id = ${input.sourceDocumentId}
      and section_key = ${input.sectionKey}
      and metadata->>'manual_recovery' = 'true'
  `;
}

async function insertManualPage(input: {
  sql: Sql;
  sourceDocumentId: string;
  sourceId: string;
  supplement: (typeof MANUAL_PAGE_SUPPLEMENTS)[number];
}) {
  const sectionKey = `manual_page_${String(input.supplement.pageNumber).padStart(4, "0")}`;
  const text = pageText(input.supplement);
  const contentHash = sha256(`${input.sourceId}:${sectionKey}:${text}`);

  await deleteExistingManualPage({
    sql: input.sql,
    sourceDocumentId: input.sourceDocumentId,
    sectionKey,
  });

  const sectionRows = await input.sql<Array<{ id: string }>>`
    insert into public.document_sections (
      source_document_id,
      document_version_id,
      section_key,
      section_title,
      original_text,
      sort_order,
      metadata
    ) values (
      ${input.sourceDocumentId},
      null,
      ${sectionKey},
      ${input.supplement.sectionTitle},
      ${text},
      ${input.supplement.pageNumber},
      ${json(input.sql, {
        manual_recovery: true,
        manual_source: input.supplement.sourceKind,
        content_hash: contentHash,
        book_title: input.supplement.bookTitle,
        chapter_title: input.supplement.chapterTitle,
        page_start: input.supplement.pageNumber,
        page_end: input.supplement.pageNumber,
        location: `page:${input.supplement.pageNumber}`,
        table_row_count: input.supplement.rows.length,
      })}
    )
    returning id
  `;

  const chunks = chunkBookPage({
    text,
    hashPrefix: `${input.sourceId}:${sectionKey}`,
    maxChars: 1_000,
    minChars: 260,
  });

  for (const chunk of chunks) {
    await input.sql`
      insert into public.source_chunks (
        source_document_id,
        document_section_id,
        source_id,
        chunk_index,
        original_text,
        chunk_hash,
        section_key,
        section_title,
        source_title,
        source_organization,
        published_at,
        updated_at,
        applicable_populations,
        scenario_tags,
        answer_eligible,
        metadata,
        book_title,
        chapter_title,
        page_start,
        page_end,
        location,
        ocr_confidence
      ) values (
        ${input.sourceDocumentId},
        ${sectionRows[0].id},
        ${input.sourceId},
        ${100000 + input.supplement.pageNumber * 100 + chunk.chunkIndex},
        ${chunk.originalText},
        ${chunk.chunkHash},
        ${sectionKey},
        ${input.supplement.sectionTitle},
        ${input.supplement.bookTitle},
        'user_provided_reference',
        null,
        ${todayDate()},
        ${[] as string[]},
        ${["local_medical_book", "manual_page_recovery", "common_disease"]},
        true,
        ${json(input.sql, {
          manual_recovery: true,
          manual_source: input.supplement.sourceKind,
          book_title: input.supplement.bookTitle,
          chapter_title: input.supplement.chapterTitle,
          page_start: input.supplement.pageNumber,
          page_end: input.supplement.pageNumber,
          location: `page:${input.supplement.pageNumber}:manual_chunk:${chunk.chunkIndex}`,
          table_row_count: input.supplement.rows.length,
          source_priority: "supplemental_book_reference",
          prescription_reference_allowed: true,
        })},
        ${input.supplement.bookTitle},
        ${input.supplement.chapterTitle},
        ${input.supplement.pageNumber},
        ${input.supplement.pageNumber},
        ${`page:${input.supplement.pageNumber}:manual_chunk:${chunk.chunkIndex}`},
        null
      )
      on conflict (chunk_hash) do update set
        original_text = excluded.original_text,
        section_title = excluded.section_title,
        source_title = excluded.source_title,
        source_organization = excluded.source_organization,
        updated_at = excluded.updated_at,
        metadata = excluded.metadata,
        book_title = excluded.book_title,
        chapter_title = excluded.chapter_title,
        page_start = excluded.page_start,
        page_end = excluded.page_end,
        location = excluded.location
    `;
  }

  return {
    page_number: input.supplement.pageNumber,
    row_count: input.supplement.rows.length,
    chunk_count: chunks.length,
    section_key: sectionKey,
  };
}

async function main() {
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const results: Array<{
    book_title: string;
    page_number: number;
    row_count: number;
    chunk_count: number;
    section_key: string;
  }> = [];

  try {
    const byBook = new Map<string, typeof MANUAL_PAGE_SUPPLEMENTS>();
    for (const supplement of MANUAL_PAGE_SUPPLEMENTS) {
      byBook.set(supplement.bookTitle, [
        ...(byBook.get(supplement.bookTitle) ?? []),
        supplement,
      ]);
    }

    for (const [bookTitle, supplements] of byBook) {
      const document = await findBookDocument(sql, bookTitle);
      for (const supplement of supplements) {
        const inserted = await insertManualPage({
          sql,
          sourceDocumentId: document.id,
          sourceId: document.source_id,
          supplement,
        });
        results.push({ book_title: bookTitle, ...inserted });
      }
    }
  } finally {
    await sql.end();
  }

  const report = {
    generated_at: new Date().toISOString(),
    text_is_redacted_from_log: true,
    action_taken: "manual_screenshot_table_pages_inserted",
    pages_recovered: results.length,
    chunks_inserted: results.reduce((sum, item) => sum + item.chunk_count, 0),
    pages: results,
  };

  await writeJsonFile(
    path.join(getBookArtifactRoot(), "skipped-pages-manual-recovery.json"),
    report,
  );

  console.log("Manual skipped page recovery complete. Page text was not printed.");
  console.log(
    JSON.stringify({
      pages_recovered: report.pages_recovered,
      chunks_inserted: report.chunks_inserted,
      pages: results.map((item) => ({
        book_title: item.book_title,
        page_number: item.page_number,
        row_count: item.row_count,
        chunk_count: item.chunk_count,
      })),
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Manual skipped page recovery failed safely.",
  );
  process.exit(1);
});
