import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { TextDecoder } from "node:util";
import { getBookArtifactRoot, writeJsonFile } from "./lib/book-pipeline";
import { CONTROL_CHAR_PATTERN, textQuality } from "./lib/text-cleaning";
import { getScriptEnv } from "../ingest/lib/script-env";
import { sha256 } from "../ingest/utils/hash";

type ReplacementBook = {
  bookTitle: string;
  envPath: string;
  defaultPath: string;
};

type TextChunk = {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  hash: string;
};

const REPLACEMENT_BOOKS: ReplacementBook[] = [
  {
    bookTitle: "医目了然：家庭常见病中成药使用指南",
    envPath: "CAREGUIDE_YIMU_TXT_PATH",
    defaultPath:
      "C:\\Users\\Sagistariam\\Downloads\\医目了然：家庭常见病中成药使用指南【文字版】 (懒兔子) (z-library.sk, 1lib.sk, z-lib.sk).txt",
  },
  {
    bookTitle: "216种常见病门诊处方全书",
    envPath: "CAREGUIDE_216_TXT_PATH",
    defaultPath:
      "C:\\Users\\Sagistariam\\Downloads\\216种常见病门诊处方全书 (任清良 赵平武) (z-library.sk, 1lib.sk, z-lib.sk).txt",
  },
];

function json(sql: Sql, value: unknown) {
  return sql.json((value ?? {}) as never);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveInputPath(book: ReplacementBook) {
  return process.env[book.envPath]?.trim() || book.defaultPath;
}

function fileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function decodeBuffer(buffer: Buffer) {
  const candidates = ["utf-8", "gb18030"].map((encoding) => {
    const text = new TextDecoder(encoding).decode(buffer);
    const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
    const chineseCount = (text.match(/[\u3400-\u9FFF]/g) ?? []).length;
    return {
      encoding,
      text,
      score: chineseCount - replacementCount * 20,
      replacementCount,
    };
  });

  return candidates.sort((a, b) => b.score - a.score)[0];
}

function cleanTxtBookText(input: string) {
  return input
    .replace(/^\uFEFF/, "")
    .replace(CONTROL_CHAR_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function splitLongParagraph(paragraph: string, maxChars: number) {
  if (Array.from(paragraph).length <= maxChars) {
    return [paragraph];
  }

  const pieces: string[] = [];
  let current = "";
  const sentences = paragraph.split(/(?<=[。！？；;])/);

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    const candidate = current ? `${current}${sentence}` : sentence;
    if (Array.from(candidate).length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      pieces.push(current);
    }
    current = sentence;
  }

  if (current) {
    pieces.push(current);
  }

  return pieces.flatMap((piece) => {
    if (Array.from(piece).length <= maxChars) {
      return [piece];
    }

    const chars = Array.from(piece);
    const slices: string[] = [];
    for (let index = 0; index < chars.length; index += maxChars) {
      slices.push(chars.slice(index, index + maxChars).join(""));
    }
    return slices;
  });
}

function chunkTxtBook(input: {
  sourceId: string;
  text: string;
  maxChars?: number;
  minChars?: number;
}) {
  const maxChars = input.maxChars ?? 1_200;
  const minChars = input.minChars ?? 360;
  const paragraphs = input.text
    .split(/\n{2,}|\n(?=第[一二三四五六七八九十百千\d]+[章节篇部])/)
    .flatMap((paragraph) => splitLongParagraph(paragraph.trim(), maxChars))
    .filter(Boolean);
  const chunks: TextChunk[] = [];
  let current = "";
  let cursor = 0;
  let currentStart = 0;

  const pushCurrent = () => {
    const text = current.trim();
    if (!text) {
      current = "";
      return;
    }

    const charStart = currentStart;
    const charEnd = charStart + Array.from(text).length;
    chunks.push({
      index: chunks.length,
      text,
      charStart,
      charEnd,
      hash: sha256(`${input.sourceId}:txt:${chunks.length}:${text}`),
    });
    cursor = charEnd;
    current = "";
    currentStart = cursor;
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (Array.from(candidate).length <= maxChars || Array.from(current).length < minChars) {
      if (!current) {
        currentStart = cursor;
      }
      current = candidate;
      continue;
    }

    pushCurrent();
    currentStart = cursor;
    current = paragraph;
  }

  pushCurrent();

  return chunks;
}

async function findBookDocument(sql: Sql, bookTitle: string) {
  const rows = await sql<Array<{ id: string; source_id: string }>>`
    select id, source_id
    from public.source_documents
    where source_type = 'medical_book'
      and document_title = ${bookTitle}
    order by updated_at desc
    limit 1
  `;

  if (!rows[0]) {
    throw new Error(`Book document not found for ${bookTitle}.`);
  }

  return rows[0];
}

async function replaceBookChunks(input: {
  sql: Sql;
  bookTitle: string;
  sourceDocumentId: string;
  sourceId: string;
  fileName: string;
  fileSizeBytes: number;
  fileHash: string;
  encoding: string;
  text: string;
}) {
  await input.sql`
    delete from public.source_chunks
    where source_document_id = ${input.sourceDocumentId}
  `;
  await input.sql`
    delete from public.document_sections
    where source_document_id = ${input.sourceDocumentId}
  `;

  const chunks = chunkTxtBook({
    sourceId: input.sourceId,
    text: input.text,
  });

  await input.sql`
    update public.source_documents
    set
      source_url = ${`local://${input.fileName}`},
      source_updated_at = ${todayDate()},
      version = 'user-provided-txt-replacement',
      metadata = metadata || ${json(input.sql, {
        source_format: "txt_replacement",
        file_name: input.fileName,
        file_hash: input.fileHash,
        file_size_bytes: input.fileSizeBytes,
        text_encoding: input.encoding,
        location_strategy: "txt_character_offsets",
      })},
      updated_at = now()
    where id = ${input.sourceDocumentId}
  `;

  await input.sql`
    update public.book_metadata
    set
      file_name = ${input.fileName},
      file_type = 'TXT',
      file_size_bytes = ${input.fileSizeBytes},
      file_hash = ${input.fileHash},
      page_count = null,
      ocr_engine = 'txt',
      ocr_status = 'txt_replacement_ingested',
      metadata = metadata || ${json(input.sql, {
        source_format: "txt_replacement",
        text_encoding: input.encoding,
        location_strategy: "txt_character_offsets",
      })},
      updated_at = now()
    where source_document_id = ${input.sourceDocumentId}
  `;

  for (const chunk of chunks) {
    const sectionKey = `txt_chunk_${String(chunk.index).padStart(5, "0")}`;
    const sectionTitle = `TXT归档片段 ${chunk.index + 1}`;
    const location = `txt:char:${chunk.charStart}-${chunk.charEnd}`;

    const sectionRows = await input.sql<Array<{ id: string }>>`
      insert into public.document_sections (
        source_document_id,
        document_version_id,
        section_key,
        section_title,
        original_text,
        sort_order,
        metadata
      ) values (
        ${input.sourceDocumentId},
        null,
        ${sectionKey},
        ${sectionTitle},
        ${chunk.text},
        ${chunk.index},
        ${json(input.sql, {
          book_title: input.bookTitle,
          source_format: "txt_replacement",
          file_name: input.fileName,
          location,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
        })}
      )
      returning id
    `;

    await input.sql`
      insert into public.source_chunks (
        source_document_id,
        document_section_id,
        source_id,
        chunk_index,
        original_text,
        chunk_hash,
        section_key,
        section_title,
        source_title,
        source_organization,
        published_at,
        updated_at,
        applicable_populations,
        scenario_tags,
        answer_eligible,
        metadata,
        book_title,
        chapter_title,
        page_start,
        page_end,
        location,
        ocr_confidence
      ) values (
        ${input.sourceDocumentId},
        ${sectionRows[0].id},
        ${input.sourceId},
        ${chunk.index},
        ${chunk.text},
        ${chunk.hash},
        ${sectionKey},
        ${sectionTitle},
        ${input.bookTitle},
        'user_provided_reference',
        null,
        ${todayDate()},
        ${[] as string[]},
        ${["local_medical_book", "txt_replacement", "common_disease"]},
        true,
        ${json(input.sql, {
          book_title: input.bookTitle,
          source_format: "txt_replacement",
          file_name: input.fileName,
          location,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
          source_priority: "supplemental_book_reference",
          prescription_reference_allowed: true,
        })},
        ${input.bookTitle},
        ${input.bookTitle},
        null,
        null,
        ${location},
        null
      )
    `;
  }

  return chunks.length;
}

async function main() {
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const results: Array<{
    book_title: string;
    file_name: string;
    encoding: string;
    char_count: number;
    chinese_ratio: number;
    gibberish_ratio: number;
    chunks_inserted: number;
  }> = [];

  try {
    for (const book of REPLACEMENT_BOOKS) {
      const filePath = resolveInputPath(book);
      if (!existsSync(filePath)) {
        throw new Error(`TXT replacement file not found for ${book.bookTitle}.`);
      }

      const buffer = await readFile(filePath);
      const decoded = decodeBuffer(buffer);
      const cleanedText = cleanTxtBookText(decoded.text);
      const quality = textQuality(cleanedText);

      if (
        quality.charCount < 1_000 ||
        quality.chineseRatio < 0.15 ||
        quality.gibberishRatio > 0.18
      ) {
        throw new Error(`TXT replacement quality is too low for ${book.bookTitle}.`);
      }

      const fileStat = await stat(filePath);
      const document = await findBookDocument(sql, book.bookTitle);
      const chunksInserted = await replaceBookChunks({
        sql,
        bookTitle: book.bookTitle,
        sourceDocumentId: document.id,
        sourceId: document.source_id,
        fileName: path.basename(filePath),
        fileSizeBytes: fileStat.size,
        fileHash: fileHash(buffer),
        encoding: decoded.encoding,
        text: cleanedText,
      });

      results.push({
        book_title: book.bookTitle,
        file_name: path.basename(filePath),
        encoding: decoded.encoding,
        char_count: quality.charCount,
        chinese_ratio: quality.chineseRatio,
        gibberish_ratio: quality.gibberishRatio,
        chunks_inserted: chunksInserted,
      });
    }
  } finally {
    await sql.end();
  }

  const report = {
    generated_at: new Date().toISOString(),
    text_is_redacted_from_log: true,
    action_taken: "txt_replacement_books_ingested",
    books: results,
  };

  await writeJsonFile(
    path.join(getBookArtifactRoot(), "txt-replacement-books-ingestion.json"),
    report,
  );

  console.log("TXT replacement ingestion complete. Full book text was not printed.");
  for (const result of results) {
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "TXT replacement ingestion failed safely.",
  );
  process.exit(1);
});

