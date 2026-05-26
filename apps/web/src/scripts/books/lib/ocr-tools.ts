import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type OcrToolchain = {
  renderer: string | null;
  rendererPath: string | null;
  tesseractPath: string | null;
  tessdataDir: string | null;
  tesseractAvailable: boolean;
  tesseractLanguages: string[];
  hasChineseAndEnglish: boolean;
};

export function commandExists(command: string) {
  if (path.isAbsolute(command)) {
    return existsSync(command);
  }

  const check = process.platform === "win32" ? "where.exe" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(check, args, { encoding: "utf8" });
  return result.status === 0;
}

function firstExisting(candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveTesseractPath() {
  const envPath = process.env.TESSERACT_EXE_PATH?.trim();

  const fallback = firstExisting([
    envPath,
    "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
    "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
  ]);

  if (fallback) {
    return fallback;
  }

  return commandExists("tesseract") ? "tesseract" : null;
}

export function resolveTessdataDir() {
  const envDir = process.env.TESSDATA_PREFIX?.trim();
  const userProfile = process.env.USERPROFILE || process.env.HOME;

  return firstExisting([
    envDir,
    userProfile ? path.join(userProfile, "tessdata") : undefined,
    "C:\\Program Files\\Tesseract-OCR\\tessdata",
    "C:\\Program Files (x86)\\Tesseract-OCR\\tessdata",
  ]);
}

export function pickRenderer() {
  const envPdfToPpm = process.env.PDFTOPPM_EXE_PATH?.trim();
  const pdfToPpm = firstExisting([
    envPdfToPpm,
    "C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe",
    "C:\\Program Files\\poppler\\bin\\pdftoppm.exe",
    "C:\\Program Files\\poppler-24.08.0\\Library\\bin\\pdftoppm.exe",
    "C:\\Program Files\\poppler-23.11.0\\Library\\bin\\pdftoppm.exe",
    "C:\\Program Files\\poppler-22.04.0\\Library\\bin\\pdftoppm.exe",
  ]);

  if (pdfToPpm) {
    return { name: "pdftoppm", path: pdfToPpm };
  }

  if (commandExists("pdftoppm")) {
    return { name: "pdftoppm", path: "pdftoppm" };
  }
  if (commandExists("mutool")) {
    return { name: "mutool", path: "mutool" };
  }
  if (commandExists("magick")) {
    return { name: "magick", path: "magick" };
  }
  if (commandExists("gswin64c")) {
    return { name: "gswin64c", path: "gswin64c" };
  }
  return null;
}

export function listTesseractLanguages(input: {
  tesseractPath: string | null;
  tessdataDir: string | null;
}) {
  if (!input.tesseractPath) {
    return [];
  }

  const args = ["--list-langs"];
  if (input.tessdataDir) {
    args.push("--tessdata-dir", input.tessdataDir);
  }

  const result = spawnSync(input.tesseractPath, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  if (result.status !== 0) {
    return [];
  }

  const output = `${result.stdout}\n${result.stderr}`;
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.toLowerCase().includes("list of available languages"),
    );
}

export function resolveOcrToolchain(): OcrToolchain {
  const renderer = pickRenderer();
  const tesseractPath = resolveTesseractPath();
  const tessdataDir = resolveTessdataDir();
  const languages = listTesseractLanguages({ tesseractPath, tessdataDir });
  const hasChineseAndEnglish =
    languages.includes("chi_sim") && languages.includes("eng");

  return {
    renderer: renderer?.name ?? null,
    rendererPath: renderer?.path ?? null,
    tesseractPath,
    tessdataDir,
    tesseractAvailable: tesseractPath != null,
    tesseractLanguages: languages,
    hasChineseAndEnglish,
  };
}
