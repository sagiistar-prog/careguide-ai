import { existsSync } from "node:fs";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import {
  type BookScanReport,
  type TextSampleReport,
  getBookArtifactRoot,
  getReportPath,
  readJsonFile,
  scanLocalBooks,
  writeJsonFile,
} from "./lib/book-pipeline";
import { extractPdfPageText, resolvePdfToTextPath } from "./lib/pdf-text-tools";
import { textQuality } from "./lib/text-cleaning";
import { getScriptEnv } from "../ingest/lib/script-env";

type IngestBookSummary = {
  file_name: string;
  book_title: string;
  source_document_id: string;
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
  classification: ReviewClassification;
  previous_available_page: number | null;
  next_available_page: number | null;
};

type ReviewReport = {
  pages: ReviewItem[];
};

type RecoveryStatus = "can_recover" | "keep_skipped";

type PageRecoveryItem = {
  book_title: string;
  file_name: string;
  page_number: number;
  previous_classification: ReviewClassification;
  recovery_status: RecoveryStatus;
  chosen_extraction_mode: "layout" | "raw" | null;
  char_count: number;
  chinese_ratio: number;
  gibberish_ratio: number;
  control_char_count: number;
  previous_available_page: number | null;
  next_available_page: number | null;
  reason: string;
};

type ContextGapRecord = {
  book_title: string;
  file_name: string;
  page_start: number;
  page_end: number;
  pages: number[];
  previous_available_page: number | null;
  next_available_page: number | null;
  reason: string;
};

type AvailableNeighbors = {
  previous_available_page: number | null;
  next_available_page: number | null;
};

function jsonSafePage(item: PageRecoveryItem) {
  return {
    book_title: item.book_title,
    page_number: item.page_number,
    previous_classification: item.previous_classification,
    recovery_status: item.recovery_status,
    chosen_extraction_mode: item.chosen_extraction_mode,
    char_count: item.char_count,
    chinese_ratio: item.chinese_ratio,
    gibberish_ratio: item.gibberish_ratio,
    control_char_count: item.control_char_count,
    previous_available_page: item.previous_available_page,
    next_available_page: item.next_available_page,
    reason: item.reason,
  };
}

function canRecover(input: {
  charCount: number;
  chineseRatio: number;
  gibberishRatio: number;
}) {
  if (input.charCount >= 120) {
    return input.chineseRatio >= 0.25 && input.gibberishRatio <= 0.08;
  }

  // Some skipped pages are image-heavy pages with short surrounding text.
  // Keep the threshold conservative: short text must be very Chinese-dense
  // and nearly free of noise before it can be considered recoverable.
  return (
    input.charCount >= 80 &&
    input.chineseRatio >= 0.5 &&
    input.gibberishRatio <= 0.05
  );
}

function chooseBestExtraction(input: {
  layout: ReturnType<typeof extractPdfPageText>;
  raw: ReturnType<typeof extractPdfPageText>;
}) {
  const candidates = [
    { mode: "layout" as const, extracted: input.layout },
    { mode: "raw" as const, extracted: input.raw },
  ]
    .filter((candidate) => candidate.extracted.ok)
    .map((candidate) => {
      const quality = textQuality(candidate.extracted.stdout);
      const score =
        quality.chineseRatio * 100 -
        quality.gibberishRatio * 120 +
        Math.min(quality.charCount, 240) / 24;

      return { ...candidate, quality, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

function groupConsecutivePages(items: PageRecoveryItem[]) {
  const groups: PageRecoveryItem[][] = [];
  const sorted = [...items].sort((a, b) => {
    const byBook = a.file_name.localeCompare(b.file_name);
    return byBook === 0 ? a.page_number - b.page_number : byBook;
  });

  for (const item of sorted) {
    const lastGroup = groups.at(-1);
    const lastItem = lastGroup?.at(-1);
    if (
      lastGroup &&
      lastItem &&
      lastItem.file_name === item.file_name &&
      lastItem.page_number + 1 === item.page_number
    ) {
      lastGroup.push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups;
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

async function latestSkippedPageSummary(sql: Sql) {
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

async function availablePagesForDocument(sql: Sql, documentId: string) {
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
  const reviewReport = await readJsonFile<ReviewReport>(
    path.join(getBookArtifactRoot(), "skipped-pages-review.json"),
  );
  const pdftotextPath =
    resolvePdfToTextPath() ??
    (textReport.extractor && existsSync(textReport.extractor)
      ? textReport.extractor
      : null);

  if (!pdftotextPath) {
    throw new Error("pdftotext is unavailable. Set PDFTOTEXT_EXE_PATH before running recovery preflight.");
  }

  const scanReport: BookScanReport = await scanLocalBooks();
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const pageItems: PageRecoveryItem[] = [];
  const excludedCoverPages: Array<{
    book_title: string;
    file_name: string;
    page_number: number;
    reason: string;
  }> = [];

  try {
    const summaries = await latestSkippedPageSummary(sql);
    const ingestByFile = new Map(
      summaries.map((summary) => [summary.file_name, summary]),
    );
    const reviewByFileAndPage = new Map(
      reviewReport.pages.map((page) => [
        `${page.file_name}:${page.page_number}`,
        page,
      ]),
    );

    for (const ingestSummary of summaries) {
      const scannedBook = scanReport.books.find(
        (book) => book.file_name === ingestSummary.file_name,
      );
      const availablePages = await availablePagesForDocument(
        sql,
        ingestSummary.source_document_id,
      );

      if (!scannedBook) {
        for (const page of ingestSummary.skipped_pages.filter((item) => item !== 1)) {
          pageItems.push({
            book_title: ingestSummary.book_title,
            file_name: ingestSummary.file_name,
            page_number: page,
            previous_classification: "safe_to_skip",
            recovery_status: "keep_skipped",
            chosen_extraction_mode: null,
            char_count: 0,
            chinese_ratio: 0,
            gibberish_ratio: 0,
            control_char_count: 0,
            previous_available_page: null,
            next_available_page: null,
            reason: "book_file_missing",
          });
        }
        continue;
      }

      for (const page of ingestSummary.skipped_pages) {
        if (page === 1) {
          excludedCoverPages.push({
            book_title: ingestSummary.book_title,
            file_name: ingestSummary.file_name,
            page_number: page,
            reason: "cover_page_excluded_from_recovery_preflight",
          });
          continue;
        }

        const reviewItem = reviewByFileAndPage.get(
          `${ingestSummary.file_name}:${page}`,
        );
        const neighbors: AvailableNeighbors = {
          previous_available_page:
            reviewItem?.previous_available_page ??
            nearestAvailable(page, availablePages, "previous"),
          next_available_page:
            reviewItem?.next_available_page ??
            nearestAvailable(page, availablePages, "next"),
        };

      const layout = extractPdfPageText({
        pdftotextPath,
        pdfPath: scannedBook.absolute_path,
          pageNumber: page,
        mode: "layout",
      });
      const raw = extractPdfPageText({
        pdftotextPath,
        pdfPath: scannedBook.absolute_path,
          pageNumber: page,
        mode: "raw",
      });
      const best = chooseBestExtraction({ layout, raw });

      if (!best) {
        pageItems.push({
          book_title: ingestSummary.book_title,
          file_name: ingestSummary.file_name,
            page_number: page,
            previous_classification: reviewItem?.classification ?? "safe_to_skip",
          recovery_status: "keep_skipped",
          chosen_extraction_mode: null,
          char_count: 0,
          chinese_ratio: 0,
          gibberish_ratio: 0,
          control_char_count: 0,
            previous_available_page: neighbors.previous_available_page,
            next_available_page: neighbors.next_available_page,
          reason: "pdftotext_second_extract_failed",
        });
        continue;
      }

      const recoverable = canRecover({
        charCount: best.quality.charCount,
        chineseRatio: best.quality.chineseRatio,
        gibberishRatio: best.quality.gibberishRatio,
      });

      pageItems.push({
        book_title: ingestSummary.book_title,
        file_name: ingestSummary.file_name,
          page_number: page,
          previous_classification: reviewItem?.classification ?? "safe_to_skip",
        recovery_status: recoverable ? "can_recover" : "keep_skipped",
        chosen_extraction_mode: best.mode,
        char_count: best.quality.charCount,
        chinese_ratio: best.quality.chineseRatio,
        gibberish_ratio: best.quality.gibberishRatio,
        control_char_count: best.quality.controlCharCount,
          previous_available_page: neighbors.previous_available_page,
          next_available_page: neighbors.next_available_page,
        reason: recoverable
          ? "cleaned_text_quality_passed_recovery_threshold"
          : "cleaned_text_quality_below_recovery_threshold",
      });
    }
    }
  } finally {
    await sql.end();
  }

  const unrecoveredContextGapPages = groupConsecutivePages(
    pageItems.filter((item) => item.recovery_status !== "can_recover"),
  ).flatMap((group) =>
    group.length > 3 ||
    group.some((item) => item.previous_classification === "possible_context_gap")
      ? group
      : [],
  );
  const contextGapRecords: ContextGapRecord[] = groupConsecutivePages(
    unrecoveredContextGapPages,
  ).map((group) => ({
    book_title: group[0].book_title,
    file_name: group[0].file_name,
    page_start: group[0].page_number,
    page_end: group.at(-1)?.page_number ?? group[0].page_number,
    pages: group.map((item) => item.page_number),
    previous_available_page: group[0].previous_available_page,
    next_available_page: group.at(-1)?.next_available_page ?? null,
    reason: "consecutive_skipped_pages_remain_below_recovery_threshold",
  }));
  const canRecoverPages = pageItems.filter(
    (item) => item.recovery_status === "can_recover",
  );
  const keepSkippedPages = pageItems.filter(
    (item) => item.recovery_status === "keep_skipped",
  );
  const report = {
    generated_at: new Date().toISOString(),
    text_is_redacted_from_report: true,
    action_taken: "preflight_only_no_database_writes",
    reviewed_scope: "all_skipped_pages_except_cover_pages",
    excluded_cover_pages: excludedCoverPages,
    recovery_thresholds: {
      normal_page: {
        min_char_count: 120,
        min_chinese_ratio: 0.25,
        max_gibberish_ratio: 0.08,
      },
      image_heavy_or_short_page: {
        min_char_count: 80,
        min_chinese_ratio: 0.5,
        max_gibberish_ratio: 0.05,
      },
    },
    counts: {
      reviewed_pages: pageItems.length,
      excluded_cover_pages: excludedCoverPages.length,
      can_recover: canRecoverPages.length,
      keep_skipped: keepSkippedPages.length,
      context_gap_records: contextGapRecords.length,
    },
    can_recover_pages: canRecoverPages.map(jsonSafePage),
    keep_skipped_pages: keepSkippedPages.map(jsonSafePage),
    context_gap_records: contextGapRecords,
  };
  const reportPath = path.join(
    getBookArtifactRoot(),
    "skipped-pages-recovery-plan.json",
  );

  await writeJsonFile(reportPath, report);

  console.log("Skipped pages recovery preflight complete. Page text was not printed.");
  console.log(JSON.stringify(report.counts));
  for (const item of pageItems) {
    console.log(JSON.stringify(jsonSafePage(item)));
  }
  for (const gap of contextGapRecords) {
    console.log(
      JSON.stringify({
        book_title: gap.book_title,
        page_start: gap.page_start,
        page_end: gap.page_end,
        previous_available_page: gap.previous_available_page,
        next_available_page: gap.next_available_page,
        reason: gap.reason,
      }),
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Skipped pages recovery preflight failed safely.",
  );
  process.exit(1);
});
