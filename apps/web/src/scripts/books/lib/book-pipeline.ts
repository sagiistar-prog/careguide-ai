import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const EXPECTED_AUTHORIZED_BOOK_COUNT = 3;

export function authorizedBookTitle(fileName: string) {
  if (
    fileName.includes("家庭常见病中成药使用指南") ||
    fileName.includes("医目了然")
  ) {
    return fileName.includes("医目了然")
      ? "医目了然：家庭常见病中成药使用指南"
      : "家庭常见病中成药使用指南";
  }

  if (fileName.includes("216种常见病门诊处方全书")) {
    return "216种常见病门诊处方全书";
  }

  if (fileName.includes("常见病家庭用药指南") || fileName.includes("14516919")) {
    return "常见病家庭用药指南";
  }

  return null;
}

export const EBOOK_EXTENSIONS = new Set([
  ".pdf",
  ".epub",
  ".docx",
  ".txt",
  ".md",
]);

export type PdfStructureSummary = {
  page_markers: number;
  image_xobjects: number;
  font_markers: number;
  text_operators: number;
};

export type LocalBookRecord = {
  file_name: string;
  book_title: string;
  file_type: string;
  file_size_bytes: number;
  file_size_mb: number;
  absolute_path: string;
  file_hash: string;
  page_count: number | null;
  suspected_scanned_pdf: boolean | null;
  scan_detection_source:
    | "user_confirmed_image_pdf"
    | "user_confirmed_text_layer"
    | "pdf_structure"
    | "unknown";
  authorization_status: "user_provided_full_authorization";
  pdf_structure: PdfStructureSummary | null;
};

export type BookScanReport = {
  generated_at: string;
  scanned_directories: string[];
  books: LocalBookRecord[];
};

export type SampledPage = {
  page_number: number;
  reason: string;
};

export type BookSample = {
  file_name: string;
  book_title: string;
  file_hash: string;
  page_count: number;
  sampled_pages: SampledPage[];
};

export type BookSamplePlan = {
  generated_at: string;
  max_pages_per_book: number;
  books: BookSample[];
};

export type PageOcrQuality = {
  file_name: string;
  file_hash: string;
  page_number: number;
  status: "completed" | "tool_unavailable" | "render_failed" | "ocr_failed";
  char_count: number;
  average_confidence: number | null;
  low_confidence_block_count?: number;
  quality_status: "pass" | "needs_review" | "likely_failed";
  reason?: string;
  artifact_path?: string;
  png_generated?: boolean;
  png_path?: string;
  tesseract_called?: boolean;
  tesseract_exit_code?: number | null;
  tesseract_language_available?: boolean;
  tsv_generated?: boolean;
  tsv_line_count?: number;
  tsv_has_text_rows?: boolean;
};

export type BookOcrQuality = {
  file_name: string;
  file_hash: string;
  sampled_page_count: number;
  completed_page_count: number;
  average_confidence: number | null;
  needs_review_pages: number[];
  likely_failed_pages: number[];
  page_results: PageOcrQuality[];
};

export type OcrSampleReport = {
  generated_at: string;
  ocr_engine: string;
  renderer: string | null;
  tesseract_available?: boolean;
  tesseract_language_available?: boolean;
  text_is_redacted_from_report: true;
  books: BookOcrQuality[];
};

export type PageTextLayerQuality = {
  file_name: string;
  book_title: string;
  file_hash: string;
  page_number: number;
  reason: string;
  status: "completed" | "tool_unavailable" | "extract_failed";
  char_count: number;
  chinese_char_count: number;
  chinese_ratio: number;
  gibberish_count: number;
  gibberish_ratio: number;
  control_char_count: number;
  noise_token_count: number;
  quality_status: "pass" | "needs_review" | "likely_failed";
  text_layer_usable: boolean;
  failure_reason?: string;
};

export type BookTextLayerQuality = {
  file_name: string;
  book_title: string;
  file_hash: string;
  sampled_page_count: number;
  completed_page_count: number;
  body_page_count: number;
  body_page_char_count: number;
  average_chinese_ratio: number | null;
  average_gibberish_ratio: number | null;
  text_layer_usable: boolean;
  needs_review_pages: number[];
  likely_failed_pages: number[];
  page_results: PageTextLayerQuality[];
};

export type TextSampleReport = {
  generated_at: string;
  extractor: string | null;
  text_is_redacted_from_report: true;
  books: BookTextLayerQuality[];
};

export function findRepoRoot() {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
}

export function getWebRoot() {
  const repoRoot = findRepoRoot();
  return path.join(repoRoot, "apps", "web");
}

export function getBookArtifactRoot() {
  return path.join(getWebRoot(), ".book-ingestion");
}

export function getReportPath(fileName: string) {
  return path.join(getBookArtifactRoot(), "reports", fileName);
}

export function toRepoRelative(absolutePath: string) {
  return path.relative(findRepoRoot(), absolutePath).replaceAll(path.sep, "/");
}

export async function ensureBookArtifactDirs() {
  await mkdir(path.join(getBookArtifactRoot(), "reports"), { recursive: true });
  await mkdir(path.join(getBookArtifactRoot(), "ocr-samples"), {
    recursive: true,
  });
  await mkdir(path.join(getBookArtifactRoot(), "text-samples"), {
    recursive: true,
  });
  await mkdir(path.join(getBookArtifactRoot(), "rendered-pages"), {
    recursive: true,
  });
}

export async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function hashFile(filePath: string) {
  const hash = createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
}

function countMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

export function analyzePdfStructure(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const pageMarkers = countMatches(latin, /\/Type\s*\/Page(?!s)\b/g);
  const imageXObjects = countMatches(latin, /\/Subtype\s*\/Image\b/g);
  const fontMarkers = countMatches(latin, /\/Font\b/g);
  const textOperators =
    countMatches(latin, /\bBT\b/g) +
    countMatches(latin, /\bET\b/g) +
    countMatches(latin, /\bT[Jj]\b/g);

  const pageCount = pageMarkers > 0 ? pageMarkers : null;
  const suspectedScanned =
    pageCount == null
      ? null
      : imageXObjects >= Math.max(1, Math.floor(pageCount * 0.5)) &&
        textOperators < Math.max(3, Math.floor(pageCount * 0.25));

  return {
    pageCount,
    suspectedScanned,
    pdfStructure: {
      page_markers: pageMarkers,
      image_xobjects: imageXObjects,
      font_markers: fontMarkers,
      text_operators: textOperators,
    },
  };
}

export async function scanLocalBooks() {
  const repoRoot = findRepoRoot();
  const candidateDirs = [
    repoRoot,
    path.join(repoRoot, "books"),
    process.env.CAREGUIDE_BOOKS_DIR,
  ].filter((item): item is string => Boolean(item));

  const uniqueDirs = Array.from(new Set(candidateDirs)).filter((dir) =>
    existsSync(dir),
  );
  const books: LocalBookRecord[] = [];

  for (const dir of uniqueDirs) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!EBOOK_EXTENSIONS.has(extension)) {
        continue;
      }

      const bookTitle = authorizedBookTitle(entry.name);
      if (!bookTitle) {
        continue;
      }

      const absolutePath = path.join(dir, entry.name);
      const fileStat = await stat(absolutePath);
      const fileHash = await hashFile(absolutePath);
      let pageCount: number | null = null;
      let pdfStructure: PdfStructureSummary | null = null;

      if (extension === ".pdf") {
        const buffer = await readFile(absolutePath);
        const pdf = analyzePdfStructure(buffer);
        pageCount = pdf.pageCount;
        pdfStructure = pdf.pdfStructure;
      }

      books.push({
        file_name: entry.name,
        book_title: bookTitle,
        file_type: extension.slice(1).toUpperCase(),
        file_size_bytes: fileStat.size,
        file_size_mb: Number((fileStat.size / 1024 / 1024).toFixed(2)),
        absolute_path: absolutePath,
        file_hash: fileHash,
        page_count: pageCount,
        suspected_scanned_pdf: false,
        scan_detection_source: "user_confirmed_text_layer",
        authorization_status: "user_provided_full_authorization",
        pdf_structure: pdfStructure,
      });
    }
  }

  books.sort((a, b) => a.file_name.localeCompare(b.file_name));

  return {
    generated_at: new Date().toISOString(),
    scanned_directories: uniqueDirs.map(toRepoRelative),
    books,
  } satisfies BookScanReport;
}

export function chooseSamplePages(pageCount: number, maxPages = 12) {
  const candidates: SampledPage[] = [
    { page_number: 1, reason: "cover_or_title_page" },
    { page_number: 2, reason: "front_matter_or_toc_candidate" },
    { page_number: 3, reason: "front_matter_or_toc_candidate" },
    { page_number: 5, reason: "front_matter_or_toc_candidate" },
    { page_number: 10, reason: "front_matter_or_toc_candidate" },
    { page_number: 20, reason: "early_body_page" },
    { page_number: 80, reason: "body_page_text_layer_check" },
    { page_number: Math.max(1, Math.round(pageCount * 0.25)), reason: "body_quarter_page" },
    { page_number: Math.max(1, Math.round(pageCount * 0.5)), reason: "body_middle_page" },
    { page_number: Math.max(1, Math.round(pageCount * 0.75)), reason: "body_late_page" },
    { page_number: Math.max(1, pageCount - 1), reason: "ending_page" },
    { page_number: pageCount, reason: "last_page" },
  ];

  const seen = new Set<number>();
  const selected: SampledPage[] = [];

  for (const candidate of candidates) {
    if (
      candidate.page_number < 1 ||
      candidate.page_number > pageCount ||
      seen.has(candidate.page_number)
    ) {
      continue;
    }

    selected.push(candidate);
    seen.add(candidate.page_number);

    if (selected.length >= maxPages) {
      break;
    }
  }

  return selected.sort((a, b) => a.page_number - b.page_number);
}

export function summarizeAverage(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => value != null);
  if (numeric.length === 0) {
    return null;
  }

  const total = numeric.reduce((sum, value) => sum + value, 0);
  return Number((total / numeric.length).toFixed(4));
}

export function qualityStatus(input: {
  averageConfidence: number | null;
  charCount: number;
}) {
  if (input.charCount < 80) {
    return "likely_failed" as const;
  }

  if (input.averageConfidence == null || input.averageConfidence < 0.85) {
    return "needs_review" as const;
  }

  return "pass" as const;
}

export function isLikelyBodyPage(page: SampledPage, pageCount: number) {
  return (
    page.page_number >= 10 &&
    page.page_number <= Math.max(10, pageCount - 2) &&
    !page.reason.includes("cover") &&
    !page.reason.includes("front_matter") &&
    !page.reason.includes("ending") &&
    !page.reason.includes("last")
  );
}
