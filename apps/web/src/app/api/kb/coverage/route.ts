import { NextResponse } from "next/server";
import { safeErrorResponse, safeRouteError } from "../../../../lib/api/errors";
import { closeServerDb, createServerDb } from "../../../../lib/db/postgres";
import { getServerEnv } from "../../../../lib/env";

export const runtime = "nodejs";

function countValue(rows: Array<{ count: string | number }>) {
  return Number(rows[0]?.count ?? 0);
}

export async function GET() {
  const db = createServerDb();

  try {
    const env = getServerEnv({ requireSupabase: true });
    const sourceDocuments = countValue(
      await db`select count(*) from public.source_documents`,
    );
    const sourceChunks = countValue(
      await db`select count(*) from public.source_chunks`,
    );
    const medicalEntities = countValue(
      await db`select count(*) from public.medical_entities`,
    );
    const entityMappings = countValue(
      await db`select count(*) from public.entity_mappings`,
    );
    const chunkEmbeddings = countValue(
      await db`
        select count(*)
        from public.chunk_embeddings
        where embedding_model = ${env.GEMINI_EMBEDDING_MODEL}
          and dimension = ${env.GEMINI_EMBEDDING_DIMENSION}
      `,
    );
    const scenarioRows = await db<{ key: string; coverage_count: string | number }[]>`
      select
        me.canonical_name as key,
        count(distinct ss.source_document_id) as coverage_count
      from public.medical_entities me
      left join public.scenario_sources ss on ss.scenario_entity_id = me.id
      where me.entity_type = 'scenario'
      group by me.canonical_name
      order by me.canonical_name
    `;
    const lastImportRun = await db<
      Array<{
        id: string;
        status: string;
        started_at: string | Date;
        finished_at: string | Date | null;
        success_count: number;
        empty_count: number;
        failure_count: number;
      }>
    >`
      select
        id,
        status,
        started_at,
        finished_at,
        success_count,
        empty_count,
        failure_count
      from public.import_runs
      order by started_at desc
      limit 1
    `;
    const lastEmbeddingRun = await db<Array<{ created_at: string | Date | null }>>`
      select max(created_at) as created_at
      from public.chunk_embeddings
    `;

    return NextResponse.json({
      source_documents: sourceDocuments,
      source_chunks: sourceChunks,
      medical_entities: medicalEntities,
      entity_mappings: entityMappings,
      embedding_coverage:
        sourceChunks === 0
          ? 0
          : Number((chunkEmbeddings / sourceChunks).toFixed(4)),
      available_scenarios: scenarioRows.map((row) => ({
        key: row.key,
        coverage_count: Number(row.coverage_count),
      })),
      last_import_run: lastImportRun[0] ?? null,
      last_embedding_run: lastEmbeddingRun[0]?.created_at ?? null,
    });
  } catch (error) {
    return safeErrorResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: safeRouteError(error),
    });
  } finally {
    await closeServerDb(db);
  }
}
