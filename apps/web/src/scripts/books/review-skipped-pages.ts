import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import {
  type BookScanReport,
  type TextSampleReport,
  getBookArtifactRoot,
  getReportPath,
  readJsonFile,
  scanLocalBooks,
} from "./lib/book-pipeline";
import { extractPdfPageText, resolvePdfToTextPath } from "./lib/pdf-text-tools";
import { pageTextQualityStatus, textQuality } from "./lib/text-cleaning";
import { getScriptEnv } from "../ingest/lib/script-env";

type IngestBookSummary = {
  file_name: string;
  book_title: string;
  source_document_id: string;
  source_documents: number;
  source_chunks: number;
  skipped_pages: number[];
};

type ReviewClassification =
  | "safe_to_skip"
  | "needs_manual_review"
  | "possible_context_gap";

type ReviewItem = {
  book_title: string;
  file_name: string;
  page_number: number;
  skip_reason: string;
  char_count: number;
  chinese_ratio: number;
  gibberish_ratio: number;
  control_char_count: number;
  is_consecutive_skip: boolean;
  consecutive_skip_run_length: number;
  previous_available_page: number | null;
  next_available_page: number | null;
  possible_body_gap: boolean;
  classification: ReviewClassification;
  status: "completed" | "extract_failed" | "tool_unavailable";
  failure_reason?: string;
};

function contiguousRunLength(page: number, skipped: Set<number>) {
  let start = page;
  let end = page;

  while (skipped.has(start - 1)) {
    start -= 1;
  }
  while (skipped.has(end + 1)) {
    end += 1;
  }

  return end - start + 1;
}

function nearestAvailable(
  page: number,
  availablePages: Set<number>,
  direction: "previous" | "next",
) {
  const sorted = Array.from(availablePages).sort((a, b) => a - b);

  if (direction === "previous") {
    return sorted.filter((item) => item < page).at(-1) ?? null;
  }

  return sorted.find((item) => item > page) ?? null;
}

function isBoundaryOrFrontMatter(page: number, pageCount: number | null) {
  return page <= 2 || (pageCount != null && page >= pageCount - 1);
}

function classifyReview(input: {
  page: number;
  pageCount: number | null;
  runLength: number;
  charCount: number;
  chineseRatio: number;
  gibberishRatio: number;
  qualityStatus: "pass" | "needs_review" | "likely_failed";
}) {
  if (input.runLength > 3) {
    return "possible_context_gap" as const;
  }

  if (input.qualityStatus === "pass") {
    return "needs_manual_review" as const;
  }

  if (
    input.charCount >= 240 &&
    input.chineseRatio >= 0.15 &&
    input.gibberishRatio <= 0.18
  ) {
    return "needs_manual_review" as const;
  }

  if (isBoundaryOrFrontMatter(input.page, input.pageCount)) {
    return "safe_to_skip" as const;
  }

  if (input.charCount < 80 || input.gibberishRatio > 0.18) {
    return "safe_to_skip" as const;
  }

  return "needs_manual_review" as const;
}

async function latestSkippedPageSummary(sql: postgres.Sql) {
  const rows = await sql<Array<{ metadata: { books?: IngestBookSummary[] } }>>`
    select metadata
    from public.import_runs
    where run_type = 'local_books_text'
      and status = 'completed'
    order by finished_at desc nulls last, started_at desc
    limit 1
  `;

  return rows[0]?.metadata.books ?? [];
}

async function availablePagesForDocument(sql: postgres.Sql, documentId: string) {
  const rows = await sql<Array<{ page_start: number }>>`
    select distinct page_start
    from public.source_chunks
    where source_document_id = ${documentId}
      and page_start is not null
    order by page_start
  `;

  return new Set(rows.map((row) => Number(row.page_start)));
}

async function main() {
  const env = getScriptEnv();
  const textReport = await readJsonFile<TextSampleReport>(
    getReportPath("book-text-sample-report.json"),
  );
  const pdftotextPath =
    resolvePdfToTextPath() ??
    (textReport.extractor && existsSync(textReport.extractor)
      ? textReport.extractor
      : null);

  if (!pdftotextPath) {
    throw new Error("pdftotext is unavailable. Set PDFTOTEXT_EXE_PATH before running books:review-skipped.");
  }

  const scanReport: BookScanReport = await scanLocalBooks();
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const items: ReviewItem[] = [];

  try {
    const summaries = await latestSkippedPageSummary(sql);

    for (const summary of summaries) {
      const scannedBook = scanReport.books.find(
        (book) => book.file_name === summary.file_name,
      );
      if (!scannedBook) {
        continue;
      }

      const skippedPages = new Set(summary.skipped_pages);
      const availablePages = await availablePagesForDocument(
        sql,
        summary.source_document_id,
      );

      for (const page of summary.skipped_pages) {
        const runLength = contiguousRunLength(page, skippedPages);
        const isConsecutive = skippedPages.has(page - 1) || skippedPages.has(page + 1);
        const previousAvailablePage = nearestAvailable(
          page,
          availablePages,
          "previous",
        );
        const nextAvailablePage = nearestAvailable(page, availablePages, "next");

        const extracted = extractPdfPageText({
          pdftotextPath,
          pdfPath: scannedBook.absolute_path,
          pageNumber: page,
        });

        if (!extracted.ok) {
          items.push({
            book_title: summary.book_title,
            file_name: summary.file_name,
            page_number: page,
            skip_reason: "pdftotext_extract_failed",
            char_count: 0,
            chinese_ratio: 0,
            gibberish_ratio: 0,
            control_char_count: 0,
            is_consecutive_skip: isConsecutive,
            consecutive_skip_run_length: runLength,
            previous_available_page: previousAvailablePage,
            next_available_page: nextAvailablePage,
            possible_body_gap: runLength > 3,
            classification:
              runLength > 3 ? "possible_context_gap" : "safe_to_skip",
            status: "extract_failed",
            failure_reason: `pdftotext_exit_${extracted.exitCode ?? "unknown"}`,
          });
          continue;
        }

        const quality = textQuality(extracted.stdout);
        const qualityStatus = pageTextQualityStatus({
          cleanedText: quality.cleanedText,
          chineseRatio: quality.chineseRatio,
          gibberishRatio: quality.gibberishRatio,
          minChars: 120,
        });
        const classification = classifyReview({
          page,
          pageCount: scannedBook.page_count,
          runLength,
          charCount: quality.charCount,
          chineseRatio: quality.chineseRatio,
          gibberishRatio: quality.gibberishRatio,
          qualityStatus,
        });

        items.push({
          book_title: summary.book_title,
          file_name: summary.file_name,
          page_number: page,
          skip_reason:
            qualityStatus === "likely_failed"
              ? "likely_failed_text_quality"
              : "skipped_but_text_extractable",
          char_count: quality.charCount,
          chinese_ratio: quality.chineseRatio,
          gibberish_ratio: quality.gibberishRatio,
          control_char_count: quality.controlCharCount,
          is_consecutive_skip: isConsecutive,
          consecutive_skip_run_length: runLength,
          previous_available_page: previousAvailablePage,
          next_available_page: nextAvailablePage,
          possible_body_gap: classification === "possible_context_gap",
          classification,
          status: "completed",
        });
      }
    }
  } finally {
    await sql.end();
  }

  const counts = {
    safe_to_skip: items.filter((item) => item.classification === "safe_to_skip")
      .length,
    needs_manual_review: items.filter(
      (item) => item.classification === "needs_manual_review",
    ).length,
    possible_context_gap: items.filter(
      (item) => item.classification === "possible_context_gap",
    ).length,
  };
  const report = {
    generated_at: new Date().toISOString(),
    text_is_redacted_from_report: true,
    counts,
    pages: items,
  };
  const reportPath = path.join(getBookArtifactRoot(), "skipped-pages-review.json");

  await writeFile(`${reportPath}.tmp`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Skipped pages review complete. Page text was not printed.");
  console.log(JSON.stringify(counts));

  for (const item of items) {
    console.log(
      JSON.stringify({
        book_title: item.book_title,
        page_number: item.page_number,
        skip_reason: item.skip_reason,
        char_count: item.char_count,
        chinese_ratio: item.chinese_ratio,
        gibberish_ratio: item.gibberish_ratio,
        control_char_count: item.control_char_count,
        is_consecutive_skip: item.is_consecutive_skip,
        previous_available_page: item.previous_available_page,
        next_available_page: item.next_available_page,
        possible_body_gap: item.possible_body_gap,
        classification: item.classification,
        status: item.status,
        failure_reason: item.failure_reason,
      }),
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Skipped pages review failed safely.",
  );
  process.exit(1);
});
