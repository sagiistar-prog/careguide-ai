import { resolveOcrToolchain } from "./lib/ocr-tools";

async function main() {
  const toolchain = resolveOcrToolchain();

  console.log(
    JSON.stringify({
      pdftoppm_available: toolchain.renderer === "pdftoppm",
      selected_renderer: toolchain.renderer,
      renderer_path_configured: toolchain.rendererPath != null,
      tesseract_available: toolchain.tesseractAvailable,
      tesseract_path_configured: toolchain.tesseractPath != null,
      tessdata_dir_configured: toolchain.tessdataDir != null,
      chi_sim_available: toolchain.tesseractLanguages.includes("chi_sim"),
      eng_available: toolchain.tesseractLanguages.includes("eng"),
      osd_available: toolchain.tesseractLanguages.includes("osd"),
      selected_language: "chi_sim+eng",
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "OCR tool check failed safely.",
  );
  process.exit(1);
});
