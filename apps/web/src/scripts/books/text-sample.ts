import {
  type BookSamplePlan,
  type BookTextLayerQuality,
  type PageTextLayerQuality,
  type TextSampleReport,
  ensureBookArtifactDirs,
  getReportPath,
  isLikelyBodyPage,
  readJsonFile,
  scanLocalBooks,
  summarizeAverage,
  writeJsonFile,
} from "./lib/book-pipeline";
import { extractPdfPageText, resolvePdfToTextPath } from "./lib/pdf-text-tools";

const GIBBERISH_TOKENS = ["\u0002\u0004", "\u0012", "√≈", "鈥", "涓", "CMY", "\uFFFD"];
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CHINESE_CHAR_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF]/g;

function countMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

function countTokenOccurrences(input: string, token: string) {
  if (token.length === 0) {
    return 0;
  }

  return input.split(token).length - 1;
}

function cleanForMetrics(input: string) {
  return input
    .replace(CONTROL_CHAR_PATTERN, "")
    .replace(/\bCMYK?\b/g, "")
    .replace(/\bCMY\b/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function assessPageQuality(input: {
  cleanedText: string;
  reason: string;
  chineseRatio: number;
  gibberishRatio: number;
}) {
  const isBody = !input.reason.includes("cover") &&
    !input.reason.includes("front_matter") &&
    !input.reason.includes("ending") &&
    !input.reason.includes("last");

  if (input.cleanedText.length < (isBody ? 160 : 20)) {
    return "likely_failed" as const;
  }

  if (input.chineseRatio >= 0.25 && input.gibberishRatio <= 0.08) {
    return "pass" as const;
  }

  if (input.chineseRatio >= 0.15 && input.gibberishRatio <= 0.18) {
    return "needs_review" as const;
  }

  return "likely_failed" as const;
}

function pageMetrics(input: {
  fileName: string;
  bookTitle: string;
  fileHash: string;
  pageNumber: number;
  reason: string;
  rawText: string;
}) {
  const cleanedText = cleanForMetrics(input.rawText);
  const charCount = Array.from(cleanedText).length;
  const chineseCharCount = countMatches(cleanedText, CHINESE_CHAR_PATTERN);
  const controlCharCount = countMatches(input.rawText, CONTROL_CHAR_PATTERN);
  const noiseTokenCount = GIBBERISH_TOKENS.reduce(
    (sum, token) => sum + countTokenOccurrences(input.rawText, token),
    0,
  );
  const gibberishCount = controlCharCount + noiseTokenCount;
  const chineseRatio =
    charCount > 0 ? Number((chineseCharCount / charCount).toFixed(4)) : 0;
  const gibberishRatio =
    charCount > 0 ? Number((gibberishCount / charCount).toFixed(4)) : 0;
  const qualityStatus = assessPageQuality({
    cleanedText,
    reason: input.reason,
    chineseRatio,
    gibberishRatio,
  });

  return {
    file_name: input.fileName,
    book_title: input.bookTitle,
    file_hash: input.fileHash,
    page_number: input.pageNumber,
    reason: input.reason,
    status: "completed" as const,
    char_count: charCount,
    chinese_char_count: chineseCharCount,
    chinese_ratio: chineseRatio,
    gibberish_count: gibberishCount,
    gibberish_ratio: gibberishRatio,
    control_char_count: controlCharCount,
    noise_token_count: noiseTokenCount,
    quality_status: qualityStatus,
    text_layer_usable: qualityStatus === "pass",
  } satisfies PageTextLayerQuality;
}

async function main() {
  await ensureBookArtifactDirs();

  const samplePlan = await readJsonFile<BookSamplePlan>(
    getReportPath("book-sample-plan.json"),
  );
  const scanReport = await scanLocalBooks();
  const pdftotextPath = resolvePdfToTextPath();
  const books: BookTextLayerQuality[] = [];

  for (const sample of samplePlan.books) {
    const scannedBook = scanReport.books.find(
      (book) => book.file_hash === sample.file_hash,
    );
    const pageResults: PageTextLayerQuality[] = [];

    for (const page of sample.sampled_pages) {
      if (!pdftotextPath || !scannedBook) {
        pageResults.push({
          file_name: sample.file_name,
          book_title: sample.book_title,
          file_hash: sample.file_hash,
          page_number: page.page_number,
          reason: page.reason,
          status: "tool_unavailable",
          char_count: 0,
          chinese_char_count: 0,
          chinese_ratio: 0,
          gibberish_count: 0,
          gibberish_ratio: 0,
          control_char_count: 0,
          noise_token_count: 0,
          quality_status: "likely_failed",
          text_layer_usable: false,
          failure_reason: !pdftotextPath
            ? "pdftotext_unavailable"
            : "source_file_not_found",
        });
        continue;
      }

      const extracted = extractPdfPageText({
        pdftotextPath,
        pdfPath: scannedBook.absolute_path,
        pageNumber: page.page_number,
      });

      if (!extracted.ok) {
        pageResults.push({
          file_name: sample.file_name,
          book_title: sample.book_title,
          file_hash: sample.file_hash,
          page_number: page.page_number,
          reason: page.reason,
          status: "extract_failed",
          char_count: 0,
          chinese_char_count: 0,
          chinese_ratio: 0,
          gibberish_count: 0,
          gibberish_ratio: 0,
          control_char_count: 0,
          noise_token_count: 0,
          quality_status: "likely_failed",
          text_layer_usable: false,
          failure_reason: `pdftotext_exit_${extracted.exitCode ?? "unknown"}`,
        });
        continue;
      }

      pageResults.push(
        pageMetrics({
          fileName: sample.file_name,
          bookTitle: sample.book_title,
          fileHash: sample.file_hash,
          pageNumber: page.page_number,
          reason: page.reason,
          rawText: extracted.stdout,
        }),
      );
    }

    const bodyResults = pageResults.filter((result) =>
      isLikelyBodyPage(
        { page_number: result.page_number, reason: result.reason },
        sample.page_count,
      ),
    );
    const bodyUsablePages = bodyResults.filter(
      (result) => result.quality_status === "pass",
    );
    const bodyPageCharCount = bodyResults.reduce(
      (sum, result) => sum + result.char_count,
      0,
    );

    books.push({
      file_name: sample.file_name,
      book_title: sample.book_title,
      file_hash: sample.file_hash,
      sampled_page_count: sample.sampled_pages.length,
      completed_page_count: pageResults.filter(
        (result) => result.status === "completed",
      ).length,
      body_page_count: bodyResults.length,
      body_page_char_count: bodyPageCharCount,
      average_chinese_ratio: summarizeAverage(
        bodyResults.map((result) => result.chinese_ratio),
      ),
      average_gibberish_ratio: summarizeAverage(
        bodyResults.map((result) => result.gibberish_ratio),
      ),
      text_layer_usable:
        bodyUsablePages.length >= 1 &&
        bodyPageCharCount >= 400 &&
        (summarizeAverage(bodyResults.map((result) => result.chinese_ratio)) ??
          0) >= 0.25,
      needs_review_pages: pageResults
        .filter((result) => result.quality_status === "needs_review")
        .map((result) => result.page_number),
      likely_failed_pages: pageResults
        .filter((result) => result.quality_status === "likely_failed")
        .map((result) => result.page_number),
      page_results: pageResults,
    });
  }

  const report: TextSampleReport = {
    generated_at: new Date().toISOString(),
    extractor: pdftotextPath,
    text_is_redacted_from_report: true,
    books,
  };

  await writeJsonFile(getReportPath("book-text-sample-report.json"), report);

  console.log("Book text layer sample complete. Page text was not printed.");
  for (const book of report.books) {
    console.log(
      JSON.stringify({
        file_name: book.file_name,
        book_title: book.book_title,
        sampled_page_count: book.sampled_page_count,
        completed_page_count: book.completed_page_count,
        body_page_char_count: book.body_page_char_count,
        average_chinese_ratio: book.average_chinese_ratio,
        average_gibberish_ratio: book.average_gibberish_ratio,
        text_layer_usable: book.text_layer_usable,
        needs_review_pages: book.needs_review_pages,
        likely_failed_pages: book.likely_failed_pages,
      }),
    );

    for (const page of book.page_results) {
      console.log(
        JSON.stringify({
          file_name: page.file_name,
          page_number: page.page_number,
          reason: page.reason,
          char_count: page.char_count,
          chinese_ratio: page.chinese_ratio,
          gibberish_ratio: page.gibberish_ratio,
          control_char_count: page.control_char_count,
          noise_token_count: page.noise_token_count,
          status: page.status,
          quality_status: page.quality_status,
          text_layer_usable: page.text_layer_usable,
          failure_reason: page.failure_reason,
        }),
      );
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Book text sample failed safely.",
  );
  process.exit(1);
});
