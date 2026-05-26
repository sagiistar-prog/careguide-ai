import { sha256 } from "../../ingest/utils/hash";

export const GIBBERISH_TOKENS = [
  "\u0002\u0004",
  "\u0012",
  "√≈",
  "鈥",
  "涓",
  "CMY",
  "\uFFFD",
] as const;

export const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const CHINESE_CHAR_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF]/g;

export function countMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

export function countTokenOccurrences(input: string, token: string) {
  if (token.length === 0) {
    return 0;
  }

  return input.split(token).length - 1;
}

export function cleanBookText(input: string) {
  return input
    .replace(CONTROL_CHAR_PATTERN, "")
    .replace(/\bCMYK?\b/g, "")
    .replace(/\bCMY\b/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textQuality(input: string) {
  const cleanedText = cleanBookText(input);
  const charCount = Array.from(cleanedText).length;
  const chineseCharCount = countMatches(cleanedText, CHINESE_CHAR_PATTERN);
  const controlCharCount = countMatches(input, CONTROL_CHAR_PATTERN);
  const noiseTokenCount = GIBBERISH_TOKENS.reduce(
    (sum, token) => sum + countTokenOccurrences(input, token),
    0,
  );
  const gibberishCount = controlCharCount + noiseTokenCount;

  return {
    cleanedText,
    charCount,
    chineseCharCount,
    chineseRatio:
      charCount > 0 ? Number((chineseCharCount / charCount).toFixed(4)) : 0,
    gibberishCount,
    gibberishRatio:
      charCount > 0 ? Number((gibberishCount / charCount).toFixed(4)) : 0,
    controlCharCount,
    noiseTokenCount,
  };
}

export function pageTextQualityStatus(input: {
  cleanedText: string;
  chineseRatio: number;
  gibberishRatio: number;
  minChars?: number;
}) {
  if (input.cleanedText.length < (input.minChars ?? 160)) {
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

export function extractPrescriptionNumbers(input: string) {
  const matches = input.match(/(?:处方|方)\s*[（(]?\s*[一二三四五六七八九十百千\d]+[）)]?/g);
  return Array.from(new Set(matches ?? [])).slice(0, 12);
}

export function extractChapterTitle(input: string, fallback: string) {
  const lines = input
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  const chapter = lines.find((line) =>
    /^第[一二三四五六七八九十百千\d]+[章节篇部]/.test(line),
  );
  if (chapter) {
    return chapter.slice(0, 80);
  }

  const heading = lines.find(
    (line) =>
      line.length >= 2 &&
      line.length <= 32 &&
      /[病症方药证治]/.test(line) &&
      !/[，。；：、,.]/.test(line),
  );

  return heading ?? fallback;
}

export function chunkBookPage(input: {
  text: string;
  hashPrefix: string;
  maxChars?: number;
  minChars?: number;
}) {
  const maxChars = input.maxChars ?? 1_200;
  const minChars = input.minChars ?? 240;
  const paragraphs = input.text.split(
    /\n{2,}|\n(?=第[一二三四五六七八九十百千\d]+[章节篇部])|\n(?=处方\s*[一二三四五六七八九十百千\d]+)/,
  );
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }
    current = "";
  };

  for (const paragraph of paragraphs.map((item) => item.trim()).filter(Boolean)) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars || current.length < minChars) {
      current = candidate;
      continue;
    }

    pushCurrent();

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    const sentences = paragraph.split(/(?<=[。！？；;])/);
    let sentenceChunk = "";
    for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
      const sentenceCandidate = sentenceChunk
        ? `${sentenceChunk}${sentence}`
        : sentence;

      if (sentenceCandidate.length <= maxChars) {
        sentenceChunk = sentenceCandidate;
      } else {
        if (sentenceChunk) {
          chunks.push(sentenceChunk);
        }
        sentenceChunk = sentence;
      }
    }
    current = sentenceChunk;
  }

  pushCurrent();

  return chunks.map((text, index) => ({
    chunkIndex: index,
    originalText: text,
    chunkHash: sha256(`${input.hashPrefix}:${index}:${text}`),
  }));
}
