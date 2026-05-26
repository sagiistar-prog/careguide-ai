import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type BookOcrQuality,
  type BookSamplePlan,
  type OcrSampleReport,
  type PageOcrQuality,
  ensureBookArtifactDirs,
  getBookArtifactRoot,
  getReportPath,
  readJsonFile,
  scanLocalBooks,
  summarizeAverage,
  qualityStatus,
  writeJsonFile,
} from "./lib/book-pipeline";
import { resolveOcrToolchain } from "./lib/ocr-tools";

type OcrBlock = {
  page_number: number;
  block_index: number;
  text: string;
  confidence: number | null;
  bbox: { left: number; top: number; width: number; height: number } | null;
  line_order: number;
  source_file_hash: string;
};

async function removeExistingRenderedImages(prefix: string) {
  const dir = path.dirname(prefix);
  const base = path.basename(prefix);

  await mkdir(dir, { recursive: true });

  for (const file of await readdir(dir)) {
    if (file.startsWith(base) && file.toLowerCase().endsWith(".png")) {
      await rm(path.join(dir, file), { force: true });
    }
  }
}

async function findRenderedImage(prefix: string) {
  const dir = path.dirname(prefix);
  const base = path.basename(prefix);
  const files = await readdir(dir);
  const match = files.find(
    (file) => file.startsWith(base) && file.toLowerCase().endsWith(".png"),
  );
  return match ? path.join(dir, match) : null;
}

async function renderPage(input: {
  renderer: string;
  rendererPath: string;
  pdfPath: string;
  pageNumber: number;
  outputPrefix: string;
}) {
  await removeExistingRenderedImages(input.outputPrefix);

  if (input.renderer === "pdftoppm") {
    const result = spawnSync(
      input.rendererPath,
      [
        "-f",
        String(input.pageNumber),
        "-l",
        String(input.pageNumber),
        "-r",
        "300",
        "-png",
        input.pdfPath,
        input.outputPrefix,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );

    if (result.status !== 0) {
      throw new Error(`pdftoppm render failed with exit code ${result.status}.`);
    }

    const image = await findRenderedImage(input.outputPrefix);
    if (!image || !existsSync(image)) {
      throw new Error("pdftoppm completed but PNG output was not found.");
    }
    return image;
  }

  if (input.renderer === "mutool") {
    const imagePath = `${input.outputPrefix}.png`;
    const result = spawnSync(
      "mutool",
      [
        "draw",
        "-o",
        imagePath,
        "-r",
        "300",
        input.pdfPath,
        String(input.pageNumber),
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );

    if (result.status !== 0 || !existsSync(imagePath)) {
      throw new Error(`mutool render failed with exit code ${result.status}.`);
    }
    return imagePath;
  }

  throw new Error("No supported renderer is available for this sample run.");
}

function parseTsvRows(tsv: string) {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines[0]?.split("\t") ?? [];
  const columnIndex = Object.fromEntries(
    header.map((name, index) => [name, index]),
  ) as Record<string, number>;

  return {
    lines,
    rows: lines.slice(1).map((line) => line.split("\t")),
    columnIndex,
  };
}

function tsvValue(
  row: string[],
  columnIndex: Record<string, number>,
  key: string,
) {
  const index = columnIndex[key];
  return index == null ? "" : row[index] ?? "";
}

function parseTesseractTsv(input: {
  tsv: string;
  pageNumber: number;
  sourceFileHash: string;
}) {
  const { lines, rows, columnIndex } = parseTsvRows(input.tsv);
  const words = rows
    .map((row) => {
      const conf = Number(tsvValue(row, columnIndex, "conf"));
      return {
        block: tsvValue(row, columnIndex, "block_num") || "0",
        line: tsvValue(row, columnIndex, "line_num") || "0",
        left: Number(tsvValue(row, columnIndex, "left")),
        top: Number(tsvValue(row, columnIndex, "top")),
        width: Number(tsvValue(row, columnIndex, "width")),
        height: Number(tsvValue(row, columnIndex, "height")),
        confidence: Number.isFinite(conf) && conf >= 0 ? conf / 100 : null,
        text: row.slice(columnIndex.text ?? 11).join("\t").trim(),
      };
    })
    .filter((word) => word.text.length > 0);

  const grouped = new Map<string, typeof words>();
  for (const word of words) {
    const key = `${word.block}:${word.line}`;
    const group = grouped.get(key) ?? [];
    group.push(word);
    grouped.set(key, group);
  }

  let lineOrder = 0;
  const blocks: OcrBlock[] = [];

  for (const group of grouped.values()) {
    const confidences = group
      .map((word) => word.confidence)
      .filter((value): value is number => value != null);
    const text = group.map((word) => word.text).join("");
    const left = Math.min(...group.map((word) => word.left));
    const top = Math.min(...group.map((word) => word.top));
    const right = Math.max(...group.map((word) => word.left + word.width));
    const bottom = Math.max(...group.map((word) => word.top + word.height));

    blocks.push({
      page_number: input.pageNumber,
      block_index: blocks.length,
      text,
      confidence:
        confidences.length > 0 ? summarizeAverage(confidences) : null,
      bbox:
        Number.isFinite(left) &&
        Number.isFinite(top) &&
        Number.isFinite(right) &&
        Number.isFinite(bottom)
          ? { left, top, width: right - left, height: bottom - top }
          : null,
      line_order: lineOrder,
      source_file_hash: input.sourceFileHash,
    });
    lineOrder += 1;
  }

  const pageText = blocks.map((block) => block.text).join("");
  const averageConfidence = summarizeAverage(
    blocks.map((block) => block.confidence),
  );
  const lowConfidenceBlockCount = blocks.filter(
    (block) => block.confidence == null || block.confidence < 0.85,
  ).length;

  return {
    blocks,
    charCount: pageText.length,
    averageConfidence,
    lowConfidenceBlockCount,
    tsvLineCount: lines.length,
    tsvHasTextRows: words.length > 0,
  };
}

async function runTesseract(input: {
  imagePath: string;
  pageNumber: number;
  sourceFileHash: string;
  tesseractPath: string;
  tessdataDir: string;
}) {
  const args = [
    input.imagePath,
    "stdout",
    "--tessdata-dir",
    input.tessdataDir,
    "-l",
    "chi_sim+eng",
    "--psm",
    "6",
    "tsv",
  ];
  const result = spawnSync(input.tesseractPath, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    return {
      ok: false as const,
      exitCode: result.status,
      parsed: null,
    };
  }

  return {
    ok: true as const,
    exitCode: result.status,
    parsed: parseTesseractTsv({
      tsv: result.stdout,
      pageNumber: input.pageNumber,
      sourceFileHash: input.sourceFileHash,
    }),
  };
}

async function main() {
  await ensureBookArtifactDirs();

  const samplePlan = await readJsonFile<BookSamplePlan>(
    getReportPath("book-sample-plan.json"),
  );
  const scanReport = await scanLocalBooks();
  const toolchain = resolveOcrToolchain();
  const canRunOcr =
    toolchain.renderer != null &&
    toolchain.rendererPath != null &&
    toolchain.tesseractPath != null &&
    toolchain.tessdataDir != null &&
    toolchain.hasChineseAndEnglish;

  const books: BookOcrQuality[] = [];

  for (const sample of samplePlan.books) {
    const scannedBook = scanReport.books.find(
      (book) => book.file_hash === sample.file_hash,
    );
    const pageResults: PageOcrQuality[] = [];

    for (const page of sample.sampled_pages) {
      if (!scannedBook || !canRunOcr || !toolchain.renderer || !toolchain.rendererPath) {
        const reason = !scannedBook
          ? "source_file_not_found"
          : toolchain.renderer == null || toolchain.rendererPath == null
            ? "local_pdf_renderer_unavailable"
            : toolchain.tesseractPath == null
              ? "tesseract_executable_unavailable"
              : toolchain.tessdataDir == null
                ? "tessdata_dir_unavailable"
                : "chi_sim_or_eng_unavailable";
        pageResults.push({
          file_name: sample.file_name,
          file_hash: sample.file_hash,
          page_number: page.page_number,
          status: "tool_unavailable",
          char_count: 0,
          average_confidence: null,
          low_confidence_block_count: 0,
          quality_status: "likely_failed",
          reason,
          png_generated: false,
          tesseract_called: false,
          tesseract_exit_code: null,
          tesseract_language_available: toolchain.hasChineseAndEnglish,
          tsv_generated: false,
          tsv_line_count: 0,
          tsv_has_text_rows: false,
        });
        continue;
      }

      const safeFileKey = sample.file_hash.slice(0, 16);
      const outputPrefix = path.join(
        getBookArtifactRoot(),
        "rendered-pages",
        `${safeFileKey}-p${String(page.page_number).padStart(4, "0")}`,
      );

      let imagePath: string | null = null;

      try {
        imagePath = await renderPage({
          renderer: toolchain.renderer,
          rendererPath: toolchain.rendererPath,
          pdfPath: scannedBook.absolute_path,
          pageNumber: page.page_number,
          outputPrefix,
        });
      } catch (error) {
        pageResults.push({
          file_name: sample.file_name,
          file_hash: sample.file_hash,
          page_number: page.page_number,
          status: "render_failed",
          char_count: 0,
          average_confidence: null,
          low_confidence_block_count: 0,
          quality_status: "likely_failed",
          reason: error instanceof Error ? error.message : "render_failed",
          png_generated: false,
          png_path: imagePath ?? undefined,
          tesseract_called: false,
          tesseract_exit_code: null,
          tesseract_language_available: toolchain.hasChineseAndEnglish,
          tsv_generated: false,
          tsv_line_count: 0,
          tsv_has_text_rows: false,
        });
        continue;
      }

      const ocr = await runTesseract({
        imagePath,
        pageNumber: page.page_number,
        sourceFileHash: sample.file_hash,
        tesseractPath: toolchain.tesseractPath!,
        tessdataDir: toolchain.tessdataDir!,
      });

      if (!ocr.ok || !ocr.parsed) {
        pageResults.push({
          file_name: sample.file_name,
          file_hash: sample.file_hash,
          page_number: page.page_number,
          status: "ocr_failed",
          char_count: 0,
          average_confidence: null,
          low_confidence_block_count: 0,
          quality_status: "likely_failed",
          reason: "tesseract_ocr_failed",
          png_generated: existsSync(imagePath),
          png_path: imagePath,
          tesseract_called: true,
          tesseract_exit_code: ocr.exitCode,
          tesseract_language_available: toolchain.hasChineseAndEnglish,
          tsv_generated: false,
          tsv_line_count: 0,
          tsv_has_text_rows: false,
        });
        await rm(imagePath, { force: true });
        continue;
      }

      const artifactPath = path.join(
        getBookArtifactRoot(),
        "ocr-samples",
        `${safeFileKey}-p${String(page.page_number).padStart(4, "0")}.json`,
      );

      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            file_name: sample.file_name,
            file_hash: sample.file_hash,
            page_number: page.page_number,
            ocr_engine: "tesseract:chi_sim+eng",
            blocks: ocr.parsed.blocks,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await rm(imagePath, { force: true });

      pageResults.push({
        file_name: sample.file_name,
        file_hash: sample.file_hash,
        page_number: page.page_number,
        status: "completed",
        char_count: ocr.parsed.charCount,
        average_confidence: ocr.parsed.averageConfidence,
        low_confidence_block_count: ocr.parsed.lowConfidenceBlockCount,
        quality_status: qualityStatus({
          averageConfidence: ocr.parsed.averageConfidence,
          charCount: ocr.parsed.charCount,
        }),
        artifact_path: path.relative(getBookArtifactRoot(), artifactPath),
        png_generated: true,
        png_path: imagePath,
        tesseract_called: true,
        tesseract_exit_code: ocr.exitCode,
        tesseract_language_available: toolchain.hasChineseAndEnglish,
        tsv_generated: true,
        tsv_line_count: ocr.parsed.tsvLineCount,
        tsv_has_text_rows: ocr.parsed.tsvHasTextRows,
      });
    }

    books.push({
      file_name: sample.file_name,
      file_hash: sample.file_hash,
      sampled_page_count: sample.sampled_pages.length,
      completed_page_count: pageResults.filter(
        (result) => result.status === "completed",
      ).length,
      average_confidence: summarizeAverage(
        pageResults.map((result) => result.average_confidence),
      ),
      needs_review_pages: pageResults
        .filter((result) => result.quality_status === "needs_review")
        .map((result) => result.page_number),
      likely_failed_pages: pageResults
        .filter((result) => result.quality_status === "likely_failed")
        .map((result) => result.page_number),
      page_results: pageResults,
    });
  }

  const report: OcrSampleReport = {
    generated_at: new Date().toISOString(),
    ocr_engine: toolchain.hasChineseAndEnglish
      ? "tesseract:chi_sim+eng"
      : "unavailable",
    renderer: toolchain.renderer,
    tesseract_available: toolchain.tesseractAvailable,
    tesseract_language_available: toolchain.hasChineseAndEnglish,
    text_is_redacted_from_report: true,
    books,
  };

  await writeJsonFile(getReportPath("ocr-sample-report.json"), report);

  console.log("OCR sample run complete. Full OCR text was not printed.");
  for (const book of report.books) {
    console.log(
      JSON.stringify({
        file_name: book.file_name,
        sampled_page_count: book.sampled_page_count,
        completed_page_count: book.completed_page_count,
        average_confidence: book.average_confidence,
        needs_review_pages: book.needs_review_pages,
        likely_failed_pages: book.likely_failed_pages,
      }),
    );

    for (const page of book.page_results) {
      console.log(
        JSON.stringify({
          file_name: page.file_name,
          page_number: page.page_number,
          char_count: page.char_count,
          average_confidence: page.average_confidence,
          low_confidence_block_count: page.low_confidence_block_count ?? 0,
          status: page.status,
          quality_status: page.quality_status,
          reason: page.reason,
          png_generated: page.png_generated,
          png_path_exists: page.png_path ? existsSync(page.png_path) : false,
          tesseract_called: page.tesseract_called,
          tesseract_exit_code: page.tesseract_exit_code,
          tesseract_language_available: page.tesseract_language_available,
          tsv_generated: page.tsv_generated,
          tsv_line_count: page.tsv_line_count,
          tsv_has_text_rows: page.tsv_has_text_rows,
        }),
      );
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Book OCR sample failed safely.",
  );
  process.exit(1);
});
