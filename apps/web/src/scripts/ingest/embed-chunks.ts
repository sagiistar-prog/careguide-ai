import { closeAdminClient, createAdminClient } from "./lib/db";
import { getScriptEnv } from "./lib/script-env";

type SourceChunk = {
  id: string;
  chunk_hash: string;
  original_text: string;
  source_id: string;
};

type GeminiEmbeddingResponse = {
  embeddings?: Array<{
    values?: number[];
  }>;
};

type SafeEmbeddingFailure = {
  chunk_id: string;
  chunk_hash: string;
  error_type: string;
  message: string;
};

class RateLimitError extends Error {
  constructor(message = "Gemini embedding request was rate limited.") {
    super(message);
    this.name = "RateLimitError";
  }
}

const CHUNK_BATCH_SIZE = Number(
  process.env.GEMINI_EMBEDDING_BATCH_SIZE ??
    process.env.EMBED_CHUNK_BATCH_SIZE ??
    5,
);
const MAX_RETRIES = Number(
  process.env.GEMINI_EMBEDDING_MAX_RETRIES ?? process.env.EMBED_MAX_RETRIES ?? 4,
);
const REQUEST_TIMEOUT_MS = 15_000;
const BATCH_DELAY_MS = Number(
  process.env.GEMINI_EMBEDDING_DELAY_MS ??
    process.env.EMBED_BATCH_DELAY_MS ??
    3_500,
);
const RETRY_DELAY_MS = Number(
  process.env.GEMINI_EMBEDDING_RETRY_DELAY_MS ??
    process.env.EMBED_RETRY_BASE_DELAY_MS ??
    60_000,
);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1_000;
  }

  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

function safeErrorSummary(error: unknown) {
  if (error instanceof Error) {
    return {
      error_type: error.name || "Error",
      message: error.message || "Embedding request failed.",
    };
  }

  return {
    error_type: "UnknownError",
    message: "Embedding request failed.",
  };
}

async function embedTexts(input: {
  apiKey: string;
  model: string;
  dimension: number;
  texts: string[];
}) {
  const modelPath = input.model.startsWith("models/")
    ? input.model
    : `models/${input.model}`;
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
          requests: input.texts.map((text) => ({
            model: modelPath,
            content: {
              parts: [{ text }],
            },
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: input.dimension,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          if (attempt < MAX_RETRIES) {
            await wait(
              retryAfterMs(response.headers.get("retry-after")) ??
                RETRY_DELAY_MS,
            );
            continue;
          }

          throw new RateLimitError();
        }

        const retryable = response.status >= 500;

        if (retryable && attempt < MAX_RETRIES) {
          await wait(RETRY_DELAY_MS * 2 ** attempt);
          continue;
        }

        throw new Error(
          `Gemini embedding request failed with status ${response.status}.`,
        );
      }

      const json = (await response.json()) as GeminiEmbeddingResponse;
      const embeddings = json.embeddings?.map((embedding) => embedding.values);

      if (!embeddings || embeddings.length !== input.texts.length) {
        throw new Error("Gemini embedding response count did not match request count.");
      }

      if (
        embeddings.some(
          (values) => !values || values.length !== input.dimension,
        )
      ) {
        throw new Error("Gemini embedding response had an unexpected dimension.");
      }

      return embeddings as number[][];
    } catch (error) {
      const retryable =
        (error instanceof DOMException && error.name === "AbortError") ||
        error instanceof TypeError;

      if (retryable && attempt < MAX_RETRIES) {
        await wait(RETRY_DELAY_MS * 2 ** attempt);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Gemini embedding batch request failed.");
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

async function getCoverage(input: {
  db: ReturnType<typeof createAdminClient>;
  embeddingModel: string;
  embeddingDimension: number;
}) {
  const totalRows = await input.db<{ count: string | number }[]>`
    select count(*)
    from public.source_chunks
  `;
  const embeddingRows = await input.db<{ count: string | number }[]>`
    select count(*)
    from public.chunk_embeddings
    where embedding_model = ${input.embeddingModel}
      and dimension = ${input.embeddingDimension}
  `;
  const skippedRows = await input.db<{ count: string | number }[]>`
    select count(*)
    from public.source_chunks sc
    where exists (
      select 1
      from public.chunk_embeddings ce
      where ce.chunk_id = sc.id
        and ce.embedding_model = ${input.embeddingModel}
        and ce.dimension = ${input.embeddingDimension}
    )
  `;

  const totalChunks = Number(totalRows[0]?.count ?? 0);
  const embeddings = Number(embeddingRows[0]?.count ?? 0);
  const skipped = Number(skippedRows[0]?.count ?? 0);

  return {
    totalChunks,
    embeddings,
    skipped,
    coverage:
      totalChunks === 0 ? 0 : Number((embeddings / totalChunks).toFixed(4)),
  };
}

async function main() {
  const env = getScriptEnv();
  const db = createAdminClient();
  const embeddingModel = env.GEMINI_EMBEDDING_MODEL;
  const embeddingDimension = env.GEMINI_EMBEDDING_DIMENSION;

  try {
    const initialCoverage = await getCoverage({
      db,
      embeddingModel,
      embeddingDimension,
    });
    let embedded = 0;
    let failed = 0;
    let rateLimited = 0;
    const failures: SafeEmbeddingFailure[] = [];

    const chunks = await db<SourceChunk[]>`
      select sc.id, sc.chunk_hash, sc.original_text, sc.source_id
      from public.source_chunks sc
      where not exists (
        select 1
        from public.chunk_embeddings ce
        where ce.chunk_id = sc.id
          and ce.embedding_model = ${embeddingModel}
          and ce.dimension = ${embeddingDimension}
      )
      order by sc.created_at asc
      limit 250
    `;

    for (let index = 0; index < chunks.length; index += CHUNK_BATCH_SIZE) {
      const batch = chunks.slice(index, index + CHUNK_BATCH_SIZE);

      let embeddings: number[][];

      try {
        embeddings = await embedTexts({
          apiKey: env.GEMINI_API_KEY,
          model: embeddingModel,
          dimension: embeddingDimension,
          texts: batch.map((chunk) => chunk.original_text),
        });
      } catch (error) {
        if (error instanceof RateLimitError) {
          rateLimited += batch.length;
          break;
        }

        const summary = safeErrorSummary(error);
        failed += batch.length;
        failures.push(
          ...batch.map((chunk) => ({
            chunk_id: chunk.id,
            chunk_hash: chunk.chunk_hash,
            error_type: summary.error_type,
            message: summary.message,
          })),
        );
        continue;
      }

      for (const [batchIndex, chunk] of batch.entries()) {
        try {
          const embedding = embeddings[batchIndex];

          if (embedding.length !== embeddingDimension) {
            throw new Error(
              "Embedding dimension did not match configured dimension.",
            );
          }

          await db`
            insert into public.chunk_embeddings (
              chunk_id,
              embedding,
              embedding_model,
              dimension,
              task_type,
              metadata
            ) values (
              ${chunk.id},
              ${toVectorLiteral(embedding)},
              ${embeddingModel},
              ${embeddingDimension},
              'retrieval_document',
              ${db.json({ source_id: chunk.source_id, provider: "gemini" })}
            )
            on conflict (chunk_id, embedding_model) do nothing
          `;

          embedded += 1;
        } catch (error) {
          const summary = safeErrorSummary(error);
          failed += 1;
          failures.push({
            chunk_id: chunk.id,
            chunk_hash: chunk.chunk_hash,
            error_type: summary.error_type,
            message: summary.message,
          });
        }
      }

      if (index + CHUNK_BATCH_SIZE < chunks.length) {
        await wait(BATCH_DELAY_MS);
      }
    }

    const finalCoverage = await getCoverage({
      db,
      embeddingModel,
      embeddingDimension,
    });

    console.log(
      JSON.stringify(
        {
          total_chunks: finalCoverage.totalChunks,
          already_embedded: initialCoverage.skipped,
          new_embeddings: embedded,
          failed_chunks: failed,
          remaining_missing: finalCoverage.totalChunks - finalCoverage.skipped,
          rate_limited_count: rateLimited,
          model: embeddingModel,
          dimension: embeddingDimension,
        },
        null,
        2,
      ),
    );
  } finally {
    await closeAdminClient(db);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`Embedding failed: ${error.message}`);
  } else {
    console.error("Embedding failed.");
  }

  process.exit(1);
});
