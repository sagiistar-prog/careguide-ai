import type { NormalizedQuery, RetrievalDb, VectorSearchResult } from "./types";

type VectorRow = {
  chunk_id: string;
  source_document_id: string;
  source_id: string;
  source_type: string;
  section_name: string;
  section_key: string;
  document_title: string;
  source_organization: string;
  published_at: string | null;
  source_updated_at: string | null;
  chunk_index: number;
  scenario_tags: string[];
  medicine_names: string[];
  ingredient_names: string[];
  applicable_populations: string[];
  book_title: string | null;
  page_start: number | null;
  page_end: number | null;
  location: string | null;
  distance: number;
  vector_score: number;
  embedding_model: string;
  dimension: number;
};

type GeminiEmbeddingResponse = {
  embeddings?: Array<{
    values?: number[];
  }>;
};

export type VectorSearchConfig = {
  apiKey: string;
  embeddingModel: string;
  embeddingDimension: number;
};

export type VectorSearchOutcome =
  | {
      ok: true;
      results: VectorSearchResult[];
    }
  | {
      ok: false;
      error: {
        error_type: string;
        message: string;
      };
      results: [];
    };

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function vectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

function asDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return typeof value === "string" ? value : null;
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      error_type: error.name || "Error",
      message: error.message || "Query embedding failed.",
    };
  }

  return {
    error_type: "UnknownError",
    message: "Query embedding failed.",
  };
}

function buildEmbeddingQueryText(query: NormalizedQuery) {
  return Array.from(
    new Set([
      query.original_query,
      query.normalized_query,
      ...query.expanded_terms,
    ].filter(Boolean)),
  ).join("\n");
}

async function embedQuery(input: VectorSearchConfig & { text: string }) {
  const modelPath = input.embeddingModel.startsWith("models/")
    ? input.embeddingModel
    : `models/${input.embeddingModel}`;
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${modelPath}:batchEmbedContents`,
  );
  url.searchParams.set("key", input.apiKey);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              model: modelPath,
              content: {
                parts: [{ text: input.text }],
              },
              taskType: "RETRIEVAL_QUERY",
              outputDimensionality: input.embeddingDimension,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;

        if (retryable && attempt < MAX_RETRIES) {
          await wait(500 * 2 ** attempt);
          continue;
        }

        throw new Error(
          `Gemini query embedding failed with status ${response.status}.`,
        );
      }

      const json = (await response.json()) as GeminiEmbeddingResponse;
      const values = json.embeddings?.[0]?.values;

      if (!values || values.length !== input.embeddingDimension) {
        throw new Error("Gemini query embedding had an unexpected dimension.");
      }

      return values;
    } catch (error) {
      const retryable =
        error instanceof DOMException && error.name === "AbortError";

      if (retryable && attempt < MAX_RETRIES) {
        await wait(500 * 2 ** attempt);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Gemini query embedding failed.");
}

export async function vectorSearch(input: {
  db: RetrievalDb;
  query: NormalizedQuery;
  topK: number;
  config: VectorSearchConfig;
}): Promise<VectorSearchOutcome> {
  try {
    const mismatchRows = await input.db<{ count: string | number }[]>`
      select count(*)
      from public.chunk_embeddings
      where embedding_model = ${input.config.embeddingModel}
        and dimension <> ${input.config.embeddingDimension}
    `;
    const mismatchCount = Number(mismatchRows[0]?.count ?? 0);

    if (mismatchCount > 0) {
      return {
        ok: false,
        results: [],
        error: {
          error_type: "EmbeddingDimensionMismatch",
          message: "Stored chunk embeddings do not match configured dimension.",
        },
      };
    }

    const embedding = await embedQuery({
      ...input.config,
      text: buildEmbeddingQueryText(input.query),
    });
    const queryVector = vectorLiteral(embedding);
    const rows = await input.db<VectorRow[]>`
      select
        sc.id as chunk_id,
        sc.source_document_id,
        sc.source_id,
        sd.source_type,
        sc.section_title as section_name,
        sc.section_key,
        sd.document_title,
        sd.source_institution as source_organization,
        sc.published_at,
        sc.updated_at as source_updated_at,
        sc.chunk_index,
        sc.scenario_tags,
        sd.medicine_names,
        sd.ingredient_names,
        sc.applicable_populations,
        sc.book_title,
        sc.page_start,
        sc.page_end,
        sc.location,
        ce.embedding <=> ${queryVector}::vector as distance,
        1 - (ce.embedding <=> ${queryVector}::vector) as vector_score,
        ce.embedding_model,
        ce.dimension
      from public.chunk_embeddings ce
      join public.source_chunks sc on sc.id = ce.chunk_id
      join public.source_documents sd on sd.id = sc.source_document_id
      where sc.answer_eligible = true
        and ce.embedding_model = ${input.config.embeddingModel}
        and ce.dimension = ${input.config.embeddingDimension}
      order by ce.embedding <=> ${queryVector}::vector asc
      limit ${input.topK}
    `;

    return {
      ok: true,
      results: rows.map((row, index) => ({
        ...row,
        published_at: asDateString(row.published_at),
        source_updated_at: asDateString(row.source_updated_at),
        vector_rank: index + 1,
        vector_score: Number(row.vector_score),
        distance: Number(row.distance),
        dimension: Number(row.dimension),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      results: [],
      error: safeError(error),
    };
  }
}
