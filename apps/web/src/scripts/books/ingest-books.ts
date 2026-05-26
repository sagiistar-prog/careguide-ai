import postgres, { type Sql } from "postgres";
import { existsSync } from "node:fs";
import {
  type BookScanReport,
  type TextSampleReport,
  getReportPath,
  readJsonFile,
  scanLocalBooks,
} from "./lib/book-pipeline";
import { extractPdfPageText, resolvePdfToTextPath } from "./lib/pdf-text-tools";
import {
  chunkBookPage,
  cleanBookText,
  extractChapterTitle,
  extractPrescriptionNumbers,
  pageTextQualityStatus,
  textQuality,
} from "./lib/text-cleaning";
import { getScriptEnv } from "../ingest/lib/script-env";
import { sha256 } from "../ingest/utils/hash";

type IngestSummary = {
  file_name: string;
  book_title: string;
  source_document_id?: string;
  source_documents: number;
  source_chunks: number;
  skipped_pages: number[];
};

function json(sql: Sql, value: unknown) {
  return sql.json((value ?? {}) as never);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function inferAuthor(fileName: string) {
  if (fileName.includes("任清良") || fileName.includes("赵平武")) {
    return "任清良；赵平武";
  }

  if (fileName.includes("懒兔子")) {
    return "懒兔子";
  }

  return null;
}

async function ensureBookSchema(sql: Sql) {
  await sql`
    insert into public.source_connectors (
      slug,
      name,
      official_organization,
      base_url,
      source_family,
      is_official,
      free_for_demo,
      runtime_allowed,
      api_key_required,
      notes
    ) values (
      'user_provided_local_books',
      'User Provided Local Medical Books',
      'user_provided_reference',
      'local://user-provided-books',
      'medical',
      true,
      true,
      false,
      false,
      'Authorized local medical books supplied by the project owner.'
    )
    on conflict (slug) do update set
      runtime_allowed = false,
      updated_at = now()
  `;

  await sql`
    create table if not exists public.book_metadata (
      id uuid primary key default gen_random_uuid(),
      source_document_id uuid not null unique references public.source_documents(id) on delete cascade,
      book_title text not null,
      author text,
      publisher text,
      publication_year integer,
      isbn text,
      file_name text not null,
      file_type text not null,
      file_size_bytes bigint not null check (file_size_bytes > 0),
      file_hash text not null,
      page_count integer check (page_count is null or page_count > 0),
      ocr_engine text,
      ocr_status text not null default 'not_started',
      authorization_status text not null default 'user_provided_full_authorization',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    alter table public.source_chunks
      add column if not exists book_title text,
      add column if not exists chapter_title text,
      add column if not exists page_start integer,
      add column if not exists page_end integer,
      add column if not exists location text,
      add column if not exists ocr_confidence numeric
  `;
}

async function startBookImportRun(sql: Sql, connectorId: string) {
  const rows = await sql<{ id: string }[]>`
    insert into public.import_runs (
      connector_id,
      run_type,
      status,
      metadata
    ) values (
      ${connectorId},
      'local_books_text',
      'running',
      ${json(sql, { stage: "local_book_text_ingestion" })}
    )
    returning id
  `;

  return rows[0].id;
}

async function finishBookImportRun(
  sql: Sql,
  importRunId: string,
  summary: IngestSummary[],
) {
  const successCount = summary.reduce(
    (sum, item) => sum + item.source_chunks,
    0,
  );

  await sql`
    update public.import_runs
    set
      status = 'completed',
      finished_at = now(),
      success_count = ${successCount},
      failure_count = 0,
      empty_count = ${summary.filter((item) => item.source_chunks === 0).length},
      error_summary = '[]'::jsonb,
      metadata = ${json(sql, { books: summary })}
    where id = ${importRunId}
  `;
}

async function upsertRawRecord(input: {
  sql: Sql;
  connectorId: string;
  importRunId: string;
  fileHash: string;
  fileName: string;
  bookTitle: string;
  pageCount: number | null;
}) {
  const payloadHash = sha256(
    `${input.fileHash}:${input.fileName}:${input.bookTitle}:text-layer`,
  );

  const rows = await input.sql<{ id: string }[]>`
    insert into public.raw_source_records (
      connector_id,
      import_run_id,
      external_id,
      source_url,
      request_url,
      content_type,
      payload_json,
      payload_hash,
      empty,
      metadata
    ) values (
      ${input.connectorId},
      ${input.importRunId},
      ${input.fileHash},
      ${`local://${input.fileName}`},
      ${`local://${input.fileName}`},
      'application/pdf',
      ${json(input.sql, {
        file_name: input.fileName,
        book_title: input.bookTitle,
        file_hash: input.fileHash,
        page_count: input.pageCount,
      })},
      ${payloadHash},
      false,
      ${json(input.sql, { text_layer_import: true })}
    )
    on conflict (connector_id, payload_hash) do update set
      import_run_id = excluded.import_run_id,
      retrieved_at = now(),
      metadata = public.raw_source_records.metadata || excluded.metadata
    returning id
  `;

  return rows[0].id;
}

async function upsertBookDocument(input: {
  sql: Sql;
  connectorId: string;
  rawSourceRecordId: string;
  sourceId: string;
  bookTitle: string;
  fileName: string;
  fileHash: string;
  fileSizeBytes: number;
  pageCount: number | null;
}) {
  const rows = await input.sql<{ id: string }[]>`
    insert into public.source_documents (
      connector_id,
      raw_source_record_id,
      source_id,
      external_id,
      document_title,
      source_institution,
      source_type,
      source_url,
      source_updated_at,
      version,
      license_note,
      country_region,
      disease_area,
      medicine_names,
      ingredient_names,
      metadata
    ) values (
      ${input.connectorId},
      ${input.rawSourceRecordId},
      ${input.sourceId},
      ${input.fileHash},
      ${input.bookTitle},
      'user_provided_reference',
      'medical_book',
      ${`local://${input.fileName}`},
      ${todayDate()},
      'user-provided-text-layer',
      'user_provided_full_authorization',
      'CN',
      ${["common_disease", "family_medication"]},
      ${[] as string[]},
      ${[] as string[]},
      ${json(input.sql, {
        file_name: input.fileName,
        file_hash: input.fileHash,
        page_count: input.pageCount,
        source_priority: "supplemental_book_reference",
        prescription_reference_allowed: true,
      })}
    )
    on conflict (source_id) do update set
      raw_source_record_id = excluded.raw_source_record_id,
      document_title = excluded.document_title,
      source_institution = excluded.source_institution,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      source_updated_at = excluded.source_updated_at,
      version = excluded.version,
      license_note = excluded.license_note,
      country_region = excluded.country_region,
      disease_area = excluded.disease_area,
      metadata = excluded.metadata,
      updated_at = now()
    returning id
  `;

  await input.sql`
    insert into public.book_metadata (
      source_document_id,
      book_title,
      author,
      publisher,
      publication_year,
      isbn,
      file_name,
      file_type,
      file_size_bytes,
      file_hash,
      page_count,
      ocr_engine,
      ocr_status,
      authorization_status,
      metadata
    ) values (
      ${rows[0].id},
      ${input.bookTitle},
      ${inferAuthor(input.fileName)},
      'user_provided_reference',
      null,
      null,
      ${input.fileName},
      'PDF',
      ${input.fileSizeBytes},
      ${input.fileHash},
      ${input.pageCount},
      'pdftotext',
      'ready_for_ingestion',
      'user_provided_full_authorization',
      ${json(input.sql, { text_layer_usable: true })}
    )
    on conflict (source_document_id) do update set
      book_title = excluded.book_title,
      author = excluded.author,
      publisher = excluded.publisher,
      file_name = excluded.file_name,
      file_type = excluded.file_type,
      file_size_bytes = excluded.file_size_bytes,
      file_hash = excluded.file_hash,
      page_count = excluded.page_count,
      ocr_engine = excluded.ocr_engine,
      ocr_status = excluded.ocr_status,
      authorization_status = excluded.authorization_status,
      metadata = excluded.metadata,
      updated_at = now()
  `;

  return rows[0].id;
}

async function ingestBookPages(input: {
  sql: Sql;
  pdftotextPath: string;
  book: BookScanReport["books"][number];
  sourceDocumentId: string;
  sourceId: string;
  likelyFailedSamplePages: Set<number>;
}) {
  let chunksInserted = 0;
  const skippedPages: number[] = [];
  let currentChapter = input.book.book_title;

  await input.sql`
    delete from public.document_sections
    where source_document_id = ${input.sourceDocumentId}
  `;

  for (let pageNumber = 1; pageNumber <= (input.book.page_count ?? 0); pageNumber += 1) {
    if (pageNumber === 1 || input.likelyFailedSamplePages.has(pageNumber)) {
      skippedPages.push(pageNumber);
      continue;
    }

    const extracted = extractPdfPageText({
      pdftotextPath: input.pdftotextPath,
      pdfPath: input.book.absolute_path,
      pageNumber,
    });

    if (!extracted.ok) {
      skippedPages.push(pageNumber);
      continue;
    }

    const quality = textQuality(extracted.stdout);
    const status = pageTextQualityStatus({
      cleanedText: quality.cleanedText,
      chineseRatio: quality.chineseRatio,
      gibberishRatio: quality.gibberishRatio,
      minChars: 120,
    });

    if (status === "likely_failed") {
      skippedPages.push(pageNumber);
      continue;
    }

    const cleanedText = cleanBookText(extracted.stdout);
    currentChapter = extractChapterTitle(cleanedText, currentChapter);
    const prescriptionNumbers = extractPrescriptionNumbers(cleanedText);
    const sectionKey = `page_${String(pageNumber).padStart(4, "0")}`;
    const sectionTitle = `${currentChapter} · 第 ${pageNumber} 页`;

    const sectionRows = await input.sql<{ id: string }[]>`
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
        ${sectionTitle},
        ${cleanedText},
        ${pageNumber},
        ${json(input.sql, {
          book_title: input.book.book_title,
          chapter_title: currentChapter,
          page_start: pageNumber,
          page_end: pageNumber,
          location: `page:${pageNumber}`,
          prescription_numbers: prescriptionNumbers,
          text_layer_quality: {
            chinese_ratio: quality.chineseRatio,
            gibberish_ratio: quality.gibberishRatio,
          },
        })}
      )
      returning id
    `;

    const pageChunks = chunkBookPage({
      text: cleanedText,
      hashPrefix: `${input.sourceId}:page:${pageNumber}`,
    });

    for (const pageChunk of pageChunks) {
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
          ${pageChunk.chunkIndex},
          ${pageChunk.originalText},
          ${pageChunk.chunkHash},
          ${sectionKey},
          ${sectionTitle},
          ${input.book.book_title},
          'user_provided_reference',
          null,
          ${todayDate()},
          ${[] as string[]},
          ${["local_medical_book", "common_disease"]},
          true,
          ${json(input.sql, {
            book_title: input.book.book_title,
            chapter_title: currentChapter,
            page_start: pageNumber,
            page_end: pageNumber,
            location: `page:${pageNumber}:chunk:${pageChunk.chunkIndex}`,
            prescription_numbers: prescriptionNumbers,
            source_priority: "supplemental_book_reference",
            prescription_reference_allowed: true,
            text_layer_quality: {
              chinese_ratio: quality.chineseRatio,
              gibberish_ratio: quality.gibberishRatio,
            },
          })},
          ${input.book.book_title},
          ${currentChapter},
          ${pageNumber},
          ${pageNumber},
          ${`page:${pageNumber}:chunk:${pageChunk.chunkIndex}`},
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
      chunksInserted += 1;
    }
  }

  return { chunksInserted, skippedPages };
}

async function main() {
  const env = getScriptEnv();
  const scanReport = await scanLocalBooks();
  const textReport = await readJsonFile<TextSampleReport>(
    getReportPath("book-text-sample-report.json"),
  );
  const pdftotextPath =
    resolvePdfToTextPath() ??
    (textReport.extractor && existsSync(textReport.extractor)
      ? textReport.extractor
      : null);

  if (!pdftotextPath) {
    throw new Error("pdftotext is unavailable. Set PDFTOTEXT_EXE_PATH before running books:ingest.");
  }

  const unusable = textReport.books.filter((book) => !book.text_layer_usable);
  if (unusable.length > 0) {
    throw new Error(
      `Text layer is not usable for ${unusable.length} book(s). Run books:text:sample and review quality first.`,
    );
  }

  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const summary: IngestSummary[] = [];

  try {
    await ensureBookSchema(sql);
    const connectorRows = await sql<{ id: string }[]>`
      select id
      from public.source_connectors
      where slug = 'user_provided_local_books'
      limit 1
    `;
    const connectorId = connectorRows[0].id;
    const importRunId = await startBookImportRun(sql, connectorId);

    for (const book of scanReport.books) {
      const textBook = textReport.books.find(
        (item) => item.file_hash === book.file_hash,
      );
      if (!textBook?.text_layer_usable) {
        continue;
      }

      const likelyFailedSamplePages = new Set(textBook.likely_failed_pages);
      const sourceId = `local_book:${book.file_hash.slice(0, 24)}`;
      const rawSourceRecordId = await upsertRawRecord({
        sql,
        connectorId,
        importRunId,
        fileHash: book.file_hash,
        fileName: book.file_name,
        bookTitle: book.book_title,
        pageCount: book.page_count,
      });
      const sourceDocumentId = await upsertBookDocument({
        sql,
        connectorId,
        rawSourceRecordId,
        sourceId,
        bookTitle: book.book_title,
        fileName: book.file_name,
        fileHash: book.file_hash,
        fileSizeBytes: book.file_size_bytes,
        pageCount: book.page_count,
      });

      const ingest = await ingestBookPages({
        sql,
        pdftotextPath,
        book,
        sourceDocumentId,
        sourceId,
        likelyFailedSamplePages,
      });

      summary.push({
        file_name: book.file_name,
        book_title: book.book_title,
        source_document_id: sourceDocumentId,
        source_documents: 1,
        source_chunks: ingest.chunksInserted,
        skipped_pages: ingest.skippedPages,
      });
    }

    await finishBookImportRun(sql, importRunId, summary);

    console.log("Book ingestion complete. Full text was not printed.");
    for (const item of summary) {
      console.log(
        JSON.stringify({
          file_name: item.file_name,
          book_title: item.book_title,
          source_documents: item.source_documents,
          source_chunks: item.source_chunks,
          skipped_pages: item.skipped_pages,
        }),
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Book ingestion failed safely.",
  );
  process.exit(1);
});
