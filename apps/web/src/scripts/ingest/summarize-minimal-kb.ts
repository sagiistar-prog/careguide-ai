import postgres from "postgres";
import { MVP_MEDICINES, MVP_SCENARIOS } from "./lib/ingest-constants";
import { getScriptEnv } from "./lib/script-env";

type CountRow = { count: string | number };
type ConnectorRow = {
  slug: string;
  success_count: string | number;
  empty_count: string | number;
  failure_count: string | number;
};

function countValue(rows: CountRow[]) {
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
  });

  try {
    const latestRun = await sql<{ id: string }[]>`
      select id
      from public.import_runs
      where run_type = 'minimal_kb'
      order by started_at desc
      limit 1
    `;
    const importRunId = latestRun[0]?.id ?? null;

    const connectorRows = await sql<ConnectorRow[]>`
          select
            sc.slug,
            count(*) filter (where rs.empty = false and rs.error is null) as success_count,
            count(*) filter (where rs.empty = true) as empty_count,
            count(*) filter (where rs.error is not null and rs.empty = false) as failure_count
          from public.source_connectors sc
          left join public.raw_source_records rs
            on rs.connector_id = sc.id
          group by sc.slug
          order by sc.slug
        `;

    const sourceDocuments = countValue(
      await sql`select count(*) from public.source_documents`,
    );
    const sourceChunks = countValue(
      await sql`select count(*) from public.source_chunks`,
    );
    const medicalEntities = countValue(
      await sql`select count(*) from public.medical_entities`,
    );
    const entityMappings = countValue(
      await sql`select count(*) from public.entity_mappings`,
    );
    const orphanChunks = countValue(
      await sql`
        select count(*)
        from public.source_chunks
        where source_document_id is null
      `,
    );
    const documentsMissingInstitution = countValue(
      await sql`
        select count(*)
        from public.source_documents
        where source_institution is null
           or length(trim(source_institution)) = 0
      `,
    );
    const answerChunksMissingDate = countValue(
      await sql`
        select count(*)
        from public.source_chunks
        where answer_eligible = true
          and published_at is null
          and updated_at is null
      `,
    );

    const scenarioCoverage: Record<string, boolean> = {};
    for (const scenario of MVP_SCENARIOS) {
      const count = countValue(
        await sql`
          select count(*)
          from public.scenario_sources ss
          join public.medical_entities me on me.id = ss.scenario_entity_id
          where me.entity_type = 'scenario'
            and me.canonical_name = ${scenario.canonicalName}
        `,
      );
      scenarioCoverage[scenario.canonicalName] = count > 0;
    }

    const medicineEntities: Record<string, boolean> = {};
    for (const medicine of MVP_MEDICINES) {
      const count = countValue(
        await sql`
          select count(*)
          from public.medical_entities
          where entity_type = 'drug'
            and canonical_name = ${medicine.name}
        `,
      );
      medicineEntities[medicine.name] = count > 0;
    }

    console.log(
      JSON.stringify(
        {
          latest_import_run_present: Boolean(importRunId),
          per_source: connectorRows.map((row) => ({
            source: row.slug,
            success: Number(row.success_count),
            empty: Number(row.empty_count),
            failure: Number(row.failure_count),
          })),
          totals: {
            source_documents: sourceDocuments,
            source_chunks: sourceChunks,
            medical_entities: medicalEntities,
            entity_mappings: entityMappings,
          },
          coverage: {
            scenarios: scenarioCoverage,
            medicines: medicineEntities,
          },
          integrity: {
            orphan_chunks: orphanChunks,
            documents_missing_institution: documentsMissingInstitution,
            answer_chunks_missing_date: answerChunksMissingDate,
          },
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
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Minimal KB summary failed.");
  }

  process.exit(1);
});
