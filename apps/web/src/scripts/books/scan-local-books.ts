import {
  ensureBookArtifactDirs,
  getReportPath,
  scanLocalBooks,
  writeJsonFile,
} from "./lib/book-pipeline";

async function main() {
  await ensureBookArtifactDirs();

  const report = await scanLocalBooks();
  await writeJsonFile(getReportPath("book-scan-report.json"), report);

  console.log("Local book scan complete. No page text was read or printed.");
  for (const book of report.books) {
    console.log(
      JSON.stringify({
        file_name: book.file_name,
        book_title: book.book_title,
        file_type: book.file_type,
        file_size_mb: book.file_size_mb,
        page_count: book.page_count,
        file_hash: book.file_hash,
        suspected_scanned_pdf: book.suspected_scanned_pdf,
        scan_detection_source: book.scan_detection_source,
      }),
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Book scan failed safely.",
  );
  process.exit(1);
});
