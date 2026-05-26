import {
  type BookScanReport,
  chooseSamplePages,
  ensureBookArtifactDirs,
  getReportPath,
  readJsonFile,
  scanLocalBooks,
  writeJsonFile,
} from "./lib/book-pipeline";

async function loadScanReport() {
  try {
    return await readJsonFile<BookScanReport>(
      getReportPath("book-scan-report.json"),
    );
  } catch {
    return scanLocalBooks();
  }
}

async function main() {
  await ensureBookArtifactDirs();

  const scanReport = await loadScanReport();
  const plan = {
    generated_at: new Date().toISOString(),
    max_pages_per_book: 12,
    books: scanReport.books
      .filter((book) => book.page_count != null && book.page_count > 0)
      .map((book) => ({
        file_name: book.file_name,
        book_title: book.book_title,
        file_hash: book.file_hash,
        page_count: book.page_count!,
        sampled_pages: chooseSamplePages(book.page_count!, 12),
      })),
  };

  await writeJsonFile(getReportPath("book-sample-plan.json"), plan);

  console.log("Book sample plan created. No OCR text was generated.");
  for (const book of plan.books) {
    console.log(
      JSON.stringify({
        file_name: book.file_name,
        page_count: book.page_count,
        sampled_pages: book.sampled_pages.map((page) => page.page_number),
      }),
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Book sampling failed safely.",
  );
  process.exit(1);
});
