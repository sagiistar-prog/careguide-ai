import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { getBookArtifactRoot, writeJsonFile } from "./lib/book-pipeline";
import { chunkBookPage, textQuality } from "./lib/text-cleaning";
import { getScriptEnv } from "../ingest/lib/script-env";
import { sha256 } from "../ingest/utils/hash";

const BOOK_TITLE = "216种常见病门诊处方全书";
const DEFAULT_DOCX_PATH = "C:\\Users\\Sagistariam\\Downloads\\111.docx";
const WORD_TO_BOOK_PAGES = [
  2, 12, 45, 77, 108, 129, 188, 203, 217, 254, 287, 321, 391, 410, 431, 432,
  495, 535, 608,
];

type ExtractedWordPage = {
  word_page: number;
  text: string;
};

function json(sql: Sql, value: unknown) {
  return sql.json((value ?? {}) as never);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveDocxPath() {
  return process.env.BOOK_216_SKIPPED_DOCX_PATH?.trim() || DEFAULT_DOCX_PATH;
}

async function writeWordExtractorScript() {
  const scriptPath = path.join(getBookArtifactRoot(), "extract-word-pages.ps1");
  const script = String.raw`
param(
  [Parameter(Mandatory=$true)][string]$DocxPath,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [Parameter(Mandatory=$true)][int]$MaxPages
)

$ErrorActionPreference = "Stop"
$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open($DocxPath, $false, $true)
  $pageCount = $doc.ComputeStatistics(2)
  $limit = [Math]::Min($pageCount, $MaxPages)
  $items = New-Object System.Collections.ArrayList

  for ($page = 1; $page -le $limit; $page++) {
    $startRange = $doc.GoTo(1, 1, $page)
    $start = $startRange.Start
    if ($page -lt $pageCount) {
      $nextRange = $doc.GoTo(1, 1, ($page + 1))
      $end = [Math]::Max($start, $nextRange.Start - 1)
    } else {
      $end = $doc.Content.End
    }

    $text = $doc.Range($start, $end).Text
    [void]$items.Add([ordered]@{
      word_page = $page
      text = $text
    })
  }

  $payload = [ordered]@{
    page_count = $pageCount
    extracted_count = $items.Count
    pages = $items
  }
  $json = $payload | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($OutPath, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Output "WORD_PAGE_EXTRACTION_OK"
} finally {
  if ($doc -ne $null) { $doc.Close($false) | Out-Null }
  if ($word -ne $null) { $word.Quit() | Out-Null }
}
`;

  await writeFile(scriptPath, script, "utf8");
  return scriptPath;
}

async function extractWordPages(docxPath: string) {
  const artifactRoot = getBookArtifactRoot();
  const scriptPath = await writeWordExtractorScript();
  const outPath = path.join(artifactRoot, "216-docx-pages-extracted.json");
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-DocxPath",
      docxPath,
      "-OutPath",
      outPath,
      "-MaxPages",
      String(WORD_TO_BOOK_PAGES.length),
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error("Word page extraction failed. Confirm Microsoft Word can open the DOCX locally.");
  }

  const payload = JSON.parse(await readFile(outPath, "utf8")) as {
    page_count: number;
    extracted_count: number;
    pages: ExtractedWordPage[];
  };

  if (payload.extracted_count < WORD_TO_BOOK_PAGES.length) {
    throw new Error(
      `Word page extraction returned ${payload.extracted_count} page(s), expected ${WORD_TO_BOOK_PAGES.length}.`,
    );
  }

  return payload;
}

async function findBookDocument(sql: Sql) {
  const rows = await sql<Array<{ id: string; source_id: string }>>`
    select id, source_id
    from public.source_documents
    where source_type = 'medical_book'
      and document_title = ${BOOK_TITLE}
    order by updated_at desc
    limit 1
  `;

  if (!rows[0]) {
    throw new Error("216 book document not found in source_documents.");
  }

  return rows[0];
}

async function deleteExistingDocxPage(input: {
  sql: Sql;
  sourceDocumentId: string;
  sectionKey: string;
}) {
  await input.sql`
    delete from public.source_chunks
    where source_document_id = ${input.sourceDocumentId}
      and section_key = ${input.sectionKey}
      and metadata->>'manual_source' = 'user_provided_docx_page_recovery'
  `;

  await input.sql`
    delete from public.document_sections
    where source_document_id = ${input.sourceDocumentId}
      and section_key = ${input.sectionKey}
      and metadata->>'manual_source' = 'user_provided_docx_page_recovery'
  `;
}

async function insertDocxRecoveredPage(input: {
  sql: Sql;
  sourceDocumentId: string;
  sourceId: string;
  wordPage: number;
  bookPage: number;
  text: string;
  sourceFileName: string;
}) {
  const quality = textQuality(input.text);
  const sectionKey = `manual_docx_page_${String(input.bookPage).padStart(4, "0")}`;
  const sectionTitle = `人工补页：第${input.bookPage}页`;
  const contentHash = sha256(`${input.sourceId}:${sectionKey}:${quality.cleanedText}`);

  await deleteExistingDocxPage({
    sql: input.sql,
    sourceDocumentId: input.sourceDocumentId,
    sectionKey,
  });

  if (
    quality.cleanedText.length < 20 ||
    quality.chineseRatio < 0.15 ||
    quality.gibberishRatio > 0.18
  ) {
    return {
      book_page: input.bookPage,
      word_page: input.wordPage,
      status: "skipped_low_quality" as const,
      char_count: quality.charCount,
      chinese_ratio: quality.chineseRatio,
      gibberish_ratio: quality.gibberishRatio,
      chunk_count: 0,
    };
  }

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
      ${sectionTitle},
      ${quality.cleanedText},
      ${input.bookPage},
      ${json(input.sql, {
        manual_recovery: true,
        manual_source: "user_provided_docx_page_recovery",
        source_file_name: input.sourceFileName,
        content_hash: contentHash,
        book_title: BOOK_TITLE,
        page_start: input.bookPage,
        page_end: input.bookPage,
        word_page: input.wordPage,
        location: `page:${input.bookPage}`,
        archive_note: "Recovered from user-provided DOCX in original book page order.",
        text_quality: {
          chinese_ratio: quality.chineseRatio,
          gibberish_ratio: quality.gibberishRatio,
          control_char_count: quality.controlCharCount,
        },
      })}
    )
    returning id
  `;

  const chunks = chunkBookPage({
    text: quality.cleanedText,
    hashPrefix: `${input.sourceId}:${sectionKey}`,
    maxChars: 1_200,
    minChars: 240,
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
        ${300000 + input.bookPage * 100 + chunk.chunkIndex},
        ${chunk.originalText},
        ${chunk.chunkHash},
        ${sectionKey},
        ${sectionTitle},
        ${BOOK_TITLE},
        'user_provided_reference',
        null,
        ${todayDate()},
        ${[] as string[]},
        ${["local_medical_book", "manual_page_recovery", "common_disease"]},
        true,
        ${json(input.sql, {
          manual_recovery: true,
          manual_source: "user_provided_docx_page_recovery",
          source_file_name: input.sourceFileName,
          book_title: BOOK_TITLE,
          page_start: input.bookPage,
          page_end: input.bookPage,
          word_page: input.wordPage,
          location: `page:${input.bookPage}:manual_docx_chunk:${chunk.chunkIndex}`,
          source_priority: "supplemental_book_reference",
          prescription_reference_allowed: true,
          archive_note: "Recovered from user-provided DOCX in original book page order.",
          text_quality: {
            chinese_ratio: quality.chineseRatio,
            gibberish_ratio: quality.gibberishRatio,
            control_char_count: quality.controlCharCount,
          },
        })},
        ${BOOK_TITLE},
        ${BOOK_TITLE},
        ${input.bookPage},
        ${input.bookPage},
        ${`page:${input.bookPage}:manual_docx_chunk:${chunk.chunkIndex}`},
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
    book_page: input.bookPage,
    word_page: input.wordPage,
    status: "inserted" as const,
    char_count: quality.charCount,
    chinese_ratio: quality.chineseRatio,
    gibberish_ratio: quality.gibberishRatio,
    chunk_count: chunks.length,
  };
}

async function main() {
  const docxPath = resolveDocxPath();
  if (!existsSync(docxPath)) {
    throw new Error("User-provided 216 skipped-page DOCX was not found.");
  }

  const extracted = await extractWordPages(docxPath);
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const results: Array<Awaited<ReturnType<typeof insertDocxRecoveredPage>>> = [];

  try {
    const document = await findBookDocument(sql);
    for (const [index, bookPage] of WORD_TO_BOOK_PAGES.entries()) {
      const wordPage = index + 1;
      const extractedPage = extracted.pages.find(
        (page) => page.word_page === wordPage,
      );
      if (!extractedPage) {
        results.push({
          book_page: bookPage,
          word_page: wordPage,
          status: "skipped_low_quality",
          char_count: 0,
          chinese_ratio: 0,
          gibberish_ratio: 0,
          chunk_count: 0,
        });
        continue;
      }

      results.push(
        await insertDocxRecoveredPage({
          sql,
          sourceDocumentId: document.id,
          sourceId: document.source_id,
          wordPage,
          bookPage,
          text: extractedPage.text,
          sourceFileName: path.basename(docxPath),
        }),
      );
    }
  } finally {
    await sql.end();
  }

  const report = {
    generated_at: new Date().toISOString(),
    text_is_redacted_from_log: true,
    action_taken: "manual_docx_pages_inserted_in_original_book_order",
    source_docx_name: path.basename(docxPath),
    word_page_count: extracted.page_count,
    expected_mapped_pages: WORD_TO_BOOK_PAGES.length,
    pages_inserted: results.filter((item) => item.status === "inserted").length,
    pages_skipped: results.filter((item) => item.status !== "inserted").length,
    chunks_inserted: results.reduce((sum, item) => sum + item.chunk_count, 0),
    pages: results,
  };

  await writeJsonFile(
    path.join(getBookArtifactRoot(), "216-skipped-docx-recovery.json"),
    report,
  );

  console.log("216 skipped-page DOCX recovery complete. Page text was not printed.");
  console.log(
    JSON.stringify({
      source_docx_name: report.source_docx_name,
      word_page_count: report.word_page_count,
      pages_inserted: report.pages_inserted,
      pages_skipped: report.pages_skipped,
      chunks_inserted: report.chunks_inserted,
      pages: results.map((item) => ({
        book_page: item.book_page,
        word_page: item.word_page,
        status: item.status,
        char_count: item.char_count,
        chinese_ratio: item.chinese_ratio,
        gibberish_ratio: item.gibberish_ratio,
        chunk_count: item.chunk_count,
      })),
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "216 skipped-page DOCX recovery failed safely.",
  );
  process.exit(1);
});
