import { sha256 } from "./hash";
import { normalizeText } from "./normalize-text";

export type TextChunk = {
  chunkIndex: number;
  originalText: string;
  chunkHash: string;
};

export type ChunkTextOptions = {
  maxChars?: number;
  minChars?: number;
  hashPrefix: string;
};

export function chunkText(input: string, options: ChunkTextOptions): TextChunk[] {
  const maxChars = options.maxChars ?? 1_400;
  const minChars = options.minChars ?? 280;
  const normalized = normalizeText(input);

  if (normalized.length === 0) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    const candidate = current
      ? `${current}\n\n${paragraph}`.trim()
      : paragraph.trim();

    if (candidate.length <= maxChars || current.length < minChars) {
      current = candidate;
      return;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length > maxChars) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";

      sentences.forEach((sentence) => {
        const sentenceCandidate = sentenceChunk
          ? `${sentenceChunk} ${sentence}`.trim()
          : sentence.trim();

        if (sentenceCandidate.length <= maxChars) {
          sentenceChunk = sentenceCandidate;
        } else {
          if (sentenceChunk) {
            chunks.push(sentenceChunk);
          }
          sentenceChunk = sentence.trim();
        }
      });

      current = sentenceChunk;
      return;
    }

    current = paragraph.trim();
  });

  if (current) {
    chunks.push(current);
  }

  return chunks.map((originalText, chunkIndex) => ({
    chunkIndex,
    originalText,
    chunkHash: sha256(`${options.hashPrefix}:${chunkIndex}:${originalText}`),
  }));
}

