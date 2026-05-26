import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function commandExists(command: string) {
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

export function resolvePdfToTextPath() {
  const envPath = process.env.PDFTOTEXT_EXE_PATH?.trim();
  if (envPath) {
    return envPath;
  }

  const explicit = firstExisting([
    "C:\\Program Files\\poppler\\Library\\bin\\pdftotext.exe",
    "C:\\Program Files\\poppler\\bin\\pdftotext.exe",
    "C:\\Program Files\\poppler-24.08.0\\Library\\bin\\pdftotext.exe",
    "C:\\Program Files\\poppler-23.11.0\\Library\\bin\\pdftotext.exe",
    "C:\\Program Files\\poppler-22.04.0\\Library\\bin\\pdftotext.exe",
  ]);

  if (explicit) {
    return explicit;
  }

  return commandExists("pdftotext") ? "pdftotext" : null;
}

export function extractPdfPageText(input: {
  pdftotextPath: string;
  pdfPath: string;
  pageNumber: number;
  mode?: "layout" | "raw";
}) {
  const layoutArgs =
    input.mode === "raw"
      ? ["-raw"]
      : ["-layout"];
  const result = spawnSync(
    input.pdftotextPath,
    [
      "-f",
      String(input.pageNumber),
      "-l",
      String(input.pageNumber),
      ...layoutArgs,
      "-enc",
      "UTF-8",
      input.pdfPath,
      "-",
    ],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  return {
    ok: result.status === 0,
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
