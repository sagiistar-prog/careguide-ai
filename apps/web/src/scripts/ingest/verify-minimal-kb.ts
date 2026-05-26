import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { MVP_MEDICINES, MVP_SCENARIOS } from "./lib/ingest-constants";
import { getScriptEnv } from "./lib/script-env";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function isEnvLocalTracked() {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "apps/web/.env.local"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function countValue(rows: Array<{ count: string | number }>) {
  return Number(rows[0]?.count ?? 0);
}

function safeDatabaseError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code);

    if (code === "42P01") {
      return "Verification failed because required tables are missing. Run migration first.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Minimal KB verification failed.";
}

async function main() {
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
  });

  try {
    const connectorCount = countValue(
      await sql`select count(*) from public.source_connectors`,
    );
    assert(connectorCount >= 9, "source_connectors seed rows are missing.");

    const runtimeAllowed = countValue(
      await sql`
        select count(*)
        from public.source_connectors
        where source_family = 'medical'
          and runtime_allowed = true
      `,
    );
    assert(runtimeAllowed === 0, "A medical connector has runtime_allowed=true.");

    for (const scenario of MVP_SCENARIOS) {
      const count = countValue(
        await sql`
          select count(*)
          from public.medical_entities
          where entity_type = 'scenario'
            and canonical_name = ${scenario.canonicalName}
        `,
      );
      assert(count === 1, `Missing MVP scenario: ${scenario.canonicalName}`);
    }

    for (const medicine of MVP_MEDICINES) {
      const count = countValue(
        await sql`
          select count(*)
          from public.medical_entities
          where entity_type = 'drug'
            and canonical_name = ${medicine.name}
        `,
      );
      assert(count === 1, `Missing MVP medicine entity: ${medicine.name}`);
    }

    const orphanChunks = countValue(
      await sql`
        select count(*)
        from public.source_chunks
        where source_document_id is null
      `,
    );
    assert(orphanChunks === 0, "A source_chunk is missing source_document_id.");

    const emptyChunks = countValue(
      await sql`
        select count(*)
        from public.source_chunks
        where original_text is null
          or length(trim(original_text)) = 0
      `,
    );
    assert(emptyChunks === 0, "A source_chunk is missing original text.");

    const missingInstitutions = countValue(
      await sql`
        select count(*)
        from public.source_documents
        where source_institution is null
          or length(trim(source_institution)) = 0
      `,
    );
    assert(
      missingInstitutions === 0,
      "A source_document is missing source institution.",
    );

    const answerChunksWithoutDate = countValue(
      await sql`
        select count(*)
        from public.source_chunks
        where answer_eligible = true
          and published_at is null
          and updated_at is null
      `,
    );
    assert(
      answerChunksWithoutDate === 0,
      "An answer-eligible chunk is missing publication or update date.",
    );

    const totalChunks = countValue(
      await sql`
        select count(*)
        from public.source_chunks
      `,
    );
    const embeddingCount = countValue(
      await sql`
        select count(*)
        from public.chunk_embeddings
        where embedding_model = ${env.GEMINI_EMBEDDING_MODEL}
          and dimension = ${env.GEMINI_EMBEDDING_DIMENSION}
      `,
    );
    const nonBookChunksMissingEmbedding = countValue(
      await sql`
        select count(*)
        from public.source_chunks sc
        join public.source_documents sd on sd.id = sc.source_document_id
        where not exists (
          select 1
          from public.chunk_embeddings ce
          where ce.chunk_id = sc.id
            and ce.embedding_model = ${env.GEMINI_EMBEDDING_MODEL}
            and ce.dimension = ${env.GEMINI_EMBEDDING_DIMENSION}
        )
          and sd.source_type <> 'medical_book'
      `,
    );
    const bookChunksMissingEmbedding = countValue(
      await sql`
        select count(*)
        from public.source_chunks sc
        join public.source_documents sd on sd.id = sc.source_document_id
        where not exists (
          select 1
          from public.chunk_embeddings ce
          where ce.chunk_id = sc.id
            and ce.embedding_model = ${env.GEMINI_EMBEDDING_MODEL}
            and ce.dimension = ${env.GEMINI_EMBEDDING_DIMENSION}
        )
          and sd.source_type = 'medical_book'
      `,
    );
    const dimensionMismatch = countValue(
      await sql`
        select count(*)
        from public.chunk_embeddings
        where embedding_model = ${env.GEMINI_EMBEDDING_MODEL}
          and dimension <> ${env.GEMINI_EMBEDDING_DIMENSION}
      `,
    );
    const orphanEmbeddings = countValue(
      await sql`
        select count(*)
        from public.chunk_embeddings ce
        left join public.source_chunks sc on sc.id = ce.chunk_id
        where sc.id is null
      `,
    );
    const embeddingCoverage =
      totalChunks === 0
        ? 0
        : Number((embeddingCount / totalChunks).toFixed(4));

    assert(
      nonBookChunksMissingEmbedding === 0,
      "A non-book source_chunk is missing an embedding for the configured embedding model and dimension.",
    );
    assert(
      dimensionMismatch === 0,
      "A chunk embedding has a dimension that does not match GEMINI_EMBEDDING_DIMENSION.",
    );
    assert(
      orphanEmbeddings === 0,
      "A chunk_embedding points to a missing source_chunk.",
    );

    assert(!isEnvLocalTracked(), "apps/web/.env.local is tracked by Git.");

    console.log(
      JSON.stringify(
        {
          status: "passed",
          source_chunks: totalChunks,
          chunk_embeddings: embeddingCount,
          embedding_coverage: embeddingCoverage,
          embedding_model: env.GEMINI_EMBEDDING_MODEL,
          embedding_dimension: env.GEMINI_EMBEDDING_DIMENSION,
          chunks_missing_embedding: nonBookChunksMissingEmbedding,
          book_chunks_pending_embedding: bookChunksMissingEmbedding,
          embedding_dimension_mismatch: dimensionMismatch,
          orphan_embeddings: orphanEmbeddings,
          git_env_local_tracked: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(safeDatabaseError(error));
  process.exit(1);
});
