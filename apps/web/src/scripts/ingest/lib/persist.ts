import type { AdminClient } from "./db";
import { requireFirst } from "./db";
import { MVP_MEDICINES, MVP_SCENARIOS } from "./ingest-constants";
import { hashJson, sha256 } from "../utils/hash";
import { chunkText } from "../utils/chunk-text";
import { normalizeText } from "../utils/normalize-text";

export type ImportRunCounters = {
  successCount: number;
  failureCount: number;
  emptyCount: number;
  errors: Array<{ source: string; message: string }>;
};

export type SectionInput = {
  sectionKey: string;
  sectionTitle: string;
  originalText: string;
  sortOrder?: number;
  applicablePopulations?: string[];
  scenarioTags?: string[];
  answerEligible?: boolean;
  metadata?: Record<string, unknown>;
};

export type DocumentInput = {
  connectorSlug: string;
  rawSourceRecordId?: string;
  sourceId: string;
  externalId?: string;
  documentTitle: string;
  sourceInstitution: string;
  sourceType: string;
  sourceUrl?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  version?: string | null;
  licenseNote?: string | null;
  countryRegion?: string | null;
  diseaseArea?: string[];
  medicineNames?: string[];
  ingredientNames?: string[];
  metadata?: Record<string, unknown>;
  sections: SectionInput[];
};

export type RawRecordInput = {
  connectorSlug: string;
  importRunId: string;
  externalId?: string;
  sourceUrl?: string;
  requestUrl?: string;
  statusCode?: number;
  contentType?: string;
  payloadJson?: unknown;
  rawText?: string;
  empty?: boolean;
  error?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const CONNECTORS = [
  ["dailymed", "DailyMed", "U.S. National Library of Medicine", "https://dailymed.nlm.nih.gov/dailymed/services/v2", false],
  ["openfda_label", "openFDA Drug Label", "U.S. Food and Drug Administration", "https://api.fda.gov/drug/label.json", true],
  ["openfda_ndc", "openFDA NDC Directory", "U.S. Food and Drug Administration", "https://api.fda.gov/drug/ndc.json", true],
  ["openfda_enforcement", "openFDA Drug Enforcement", "U.S. Food and Drug Administration", "https://api.fda.gov/drug/enforcement.json", true],
  ["rxnorm", "RxNorm", "U.S. National Library of Medicine", "https://rxnav.nlm.nih.gov/REST", false],
  ["rxterms", "RxTerms", "U.S. National Library of Medicine", "https://rxnav.nlm.nih.gov/REST", false],
  ["rxclass", "RxClass", "U.S. National Library of Medicine", "https://rxnav.nlm.nih.gov/REST/rxclass", false],
  ["medlineplus_connect", "MedlinePlus Connect", "U.S. National Library of Medicine", "https://connect.medlineplus.gov/service", false],
  ["nhs_website_content", "NHS Website Content API", "NHS England", "https://api.nhs.uk", true],
] as const;

function textArray(_db: AdminClient, values: readonly string[] | undefined) {
  return [...(values ?? [])];
}

function json(db: AdminClient, value: unknown) {
  return db.json((value ?? {}) as never);
}

export async function ensureBaseSeedData(db: AdminClient) {
  for (const [slug, name, organization, baseUrl, apiKeyRequired] of CONNECTORS) {
    await db`
      insert into public.source_connectors (
        slug,
        name,
        official_organization,
        base_url,
        source_family,
        is_official,
        free_for_demo,
        runtime_allowed,
        api_key_required,
        notes
      ) values (
        ${slug},
        ${name},
        ${organization},
        ${baseUrl},
        'medical',
        true,
        true,
        false,
        ${apiKeyRequired},
        'Seeded for CareGuide AI minimal knowledge base.'
      )
      on conflict (slug) do update set
        name = excluded.name,
        official_organization = excluded.official_organization,
        base_url = excluded.base_url,
        source_family = excluded.source_family,
        is_official = excluded.is_official,
        free_for_demo = excluded.free_for_demo,
        runtime_allowed = false,
        api_key_required = excluded.api_key_required,
        notes = excluded.notes,
        updated_at = now()
    `;
  }

  const entities = [
    ...MVP_SCENARIOS.map((scenario) => ({
      entityType: "scenario",
      canonicalName: scenario.canonicalName,
      displayName: scenario.displayName,
      description: "MVP CareGuide AI scenario.",
      metadata: { mvp: true, search_terms: scenario.searchTerms },
    })),
    ...MVP_MEDICINES.map((medicine) => ({
      entityType: "drug",
      canonicalName: medicine.name,
      displayName: medicine.name,
      description: "MVP CareGuide AI medicine.",
      metadata: {
        mvp: true,
        aliases: medicine.aliases,
        scenario_tags: medicine.scenarioTags,
      },
    })),
    ...MVP_MEDICINES.filter((medicine) => medicine.name !== "paracetamol").map(
      (medicine) => ({
        entityType: "ingredient",
        canonicalName: medicine.name,
        displayName: medicine.name,
        description: "MVP CareGuide AI ingredient.",
        metadata: { mvp: true },
      }),
    ),
  ];

  for (const entity of entities) {
    await db`
      insert into public.medical_entities (
        entity_type,
        canonical_name,
        display_name,
        description,
        metadata
      ) values (
        ${entity.entityType},
        ${entity.canonicalName},
        ${entity.displayName},
        ${entity.description},
        ${json(db, entity.metadata)}
      )
      on conflict (entity_type, canonical_name) do update set
        display_name = excluded.display_name,
        description = excluded.description,
        metadata = public.medical_entities.metadata || excluded.metadata,
        updated_at = now()
    `;
  }
}

export async function getConnectorId(db: AdminClient, slug: string) {
  const rows = await db<{ id: string }[]>`
    select id
    from public.source_connectors
    where slug = ${slug}
    limit 1
  `;

  return requireFirst(rows, `connector ${slug}`).id;
}

export async function hasRawRecordsForConnector(
  db: AdminClient,
  connectorSlug: string,
) {
  const rows = await db<{ count: string | number }[]>`
    select count(*) as count
    from public.raw_source_records rs
    join public.source_connectors sc on sc.id = rs.connector_id
    where sc.slug = ${connectorSlug}
  `;

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function startImportRun(db: AdminClient, runType: string) {
  const rows = await db<{ id: string }[]>`
    insert into public.import_runs (
      run_type,
      status,
      metadata
    ) values (
      ${runType},
      'running',
      ${json(db, {
        stage: "minimal_real_kb",
        connectors: CONNECTORS.map(([slug]) => slug),
      })}
    )
    returning id
  `;

  return requireFirst(rows, "start import run").id;
}

export async function markStaleRunningImportRuns(db: AdminClient) {
  await db`
    update public.import_runs
    set
      status = 'failed',
      finished_at = now(),
      failure_count = greatest(failure_count, 1),
      error_summary = error_summary || ${json(db, [
        {
          source: "ingest-minimal-kb",
          message: "Previous import run was interrupted before completion.",
        },
      ])}
    where run_type = 'minimal_kb'
      and status = 'running'
      and started_at < now() - interval '2 minutes'
  `;
}

export async function finishImportRun(
  db: AdminClient,
  importRunId: string,
  counters: ImportRunCounters,
) {
  const status =
    counters.failureCount > 0 ? "completed_with_errors" : "completed";

  await db`
    update public.import_runs
    set
      status = ${status},
      finished_at = now(),
      success_count = ${counters.successCount},
      failure_count = ${counters.failureCount},
      empty_count = ${counters.emptyCount},
      error_summary = ${json(db, counters.errors)}
    where id = ${importRunId}
  `;
}

export async function failImportRun(
  db: AdminClient,
  importRunId: string,
  errorMessage: string,
) {
  await db`
    update public.import_runs
    set
      status = 'failed',
      finished_at = now(),
      failure_count = 1,
      error_summary = ${json(db, [
        { source: "ingest-minimal-kb", message: errorMessage },
      ])}
    where id = ${importRunId}
  `;
}

export async function recordRawSource(
  db: AdminClient,
  input: RawRecordInput,
) {
  const connectorId = await getConnectorId(db, input.connectorSlug);
  const payloadHash = input.payloadJson
    ? hashJson(input.payloadJson)
    : sha256(
        JSON.stringify({
          rawText: input.rawText ?? "",
          error: input.error ?? null,
          externalId: input.externalId ?? null,
          empty: input.empty ?? false,
        }),
      );

  const rows = await db<{ id: string }[]>`
    insert into public.raw_source_records (
      connector_id,
      import_run_id,
      external_id,
      source_url,
      request_url,
      status_code,
      content_type,
      payload_json,
      raw_text,
      payload_hash,
      empty,
      error,
      metadata
    ) values (
      ${connectorId},
      ${input.importRunId},
      ${input.externalId ?? null},
      ${input.sourceUrl ?? null},
      ${input.requestUrl ?? null},
      ${input.statusCode ?? null},
      ${input.contentType ?? "application/json"},
      ${input.payloadJson == null ? null : json(db, input.payloadJson)},
      ${input.rawText ?? null},
      ${payloadHash},
      ${input.empty ?? false},
      ${input.error == null ? null : json(db, input.error)},
      ${json(db, input.metadata ?? {})}
    )
    on conflict (connector_id, payload_hash) do update set
      import_run_id = excluded.import_run_id,
      external_id = excluded.external_id,
      source_url = excluded.source_url,
      request_url = excluded.request_url,
      status_code = excluded.status_code,
      content_type = excluded.content_type,
      payload_json = excluded.payload_json,
      raw_text = excluded.raw_text,
      empty = excluded.empty,
      error = excluded.error,
      retrieved_at = now(),
      metadata = excluded.metadata
    returning id
  `;

  return requireFirst(rows, "record raw source").id;
}

export async function persistDocument(
  db: AdminClient,
  input: DocumentInput,
) {
  const connectorId = await getConnectorId(db, input.connectorSlug);
  const sections = input.sections
    .map((section) => ({
      ...section,
      originalText: normalizeText(section.originalText),
    }))
    .filter((section) => section.originalText.length > 0);

  if (sections.length === 0) {
    return null;
  }

  const contentHash = sha256(
    `${input.sourceId}:${sections
      .map((section) => `${section.sectionKey}:${section.originalText}`)
      .join("\n")}`,
  );

  const documentRows = await db<{ id: string }[]>`
    insert into public.source_documents (
      connector_id,
      raw_source_record_id,
      source_id,
      external_id,
      document_title,
      source_institution,
      source_type,
      source_url,
      published_at,
      source_updated_at,
      version,
      license_note,
      country_region,
      disease_area,
      medicine_names,
      ingredient_names,
      metadata
    ) values (
      ${connectorId},
      ${input.rawSourceRecordId ?? null},
      ${input.sourceId},
      ${input.externalId ?? null},
      ${input.documentTitle},
      ${input.sourceInstitution},
      ${input.sourceType},
      ${input.sourceUrl ?? null},
      ${input.publishedAt ?? null},
      ${input.updatedAt ?? null},
      ${input.version ?? null},
      ${input.licenseNote ?? null},
      ${input.countryRegion ?? null},
      ${textArray(db, input.diseaseArea)},
      ${textArray(db, input.medicineNames)},
      ${textArray(db, input.ingredientNames)},
      ${json(db, input.metadata ?? {})}
    )
    on conflict (source_id) do update set
      connector_id = excluded.connector_id,
      raw_source_record_id = excluded.raw_source_record_id,
      external_id = excluded.external_id,
      document_title = excluded.document_title,
      source_institution = excluded.source_institution,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      published_at = excluded.published_at,
      source_updated_at = excluded.source_updated_at,
      version = excluded.version,
      license_note = excluded.license_note,
      country_region = excluded.country_region,
      disease_area = excluded.disease_area,
      medicine_names = excluded.medicine_names,
      ingredient_names = excluded.ingredient_names,
      metadata = excluded.metadata,
      updated_at = now()
    returning id
  `;

  const sourceDocumentId = requireFirst(
    documentRows,
    `persist document ${input.sourceId}`,
  ).id;

  const versionRows = await db<{ id: string }[]>`
    insert into public.document_versions (
      source_document_id,
      raw_source_record_id,
      version_label,
      published_at,
      updated_at,
      content_hash,
      metadata
    ) values (
      ${sourceDocumentId},
      ${input.rawSourceRecordId ?? null},
      ${input.version ?? input.updatedAt ?? input.publishedAt ?? null},
      ${input.publishedAt ?? null},
      ${input.updatedAt ?? null},
      ${contentHash},
      ${json(db, { source_id: input.sourceId })}
    )
    on conflict (source_document_id, content_hash) do update set
      raw_source_record_id = excluded.raw_source_record_id,
      version_label = excluded.version_label,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at,
      metadata = excluded.metadata
    returning id
  `;

  const documentVersionId = requireFirst(
    versionRows,
    `persist document version ${input.sourceId}`,
  ).id;

  await db`
    delete from public.document_sections
    where source_document_id = ${sourceDocumentId}
  `;

  for (const section of sections) {
    const sectionRows = await db<{ id: string }[]>`
      insert into public.document_sections (
        source_document_id,
        document_version_id,
        section_key,
        section_title,
        original_text,
        sort_order,
        metadata
      ) values (
        ${sourceDocumentId},
        ${documentVersionId},
        ${section.sectionKey},
        ${section.sectionTitle},
        ${section.originalText},
        ${section.sortOrder ?? 0},
        ${json(db, section.metadata ?? {})}
      )
      returning id
    `;

    const documentSectionId = requireFirst(
      sectionRows,
      `persist section ${input.sourceId}:${section.sectionKey}`,
    ).id;

    const chunks = chunkText(section.originalText, {
      hashPrefix: `${input.sourceId}:${section.sectionKey}`,
    });

    for (const chunk of chunks) {
      await db`
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
          metadata
        ) values (
          ${sourceDocumentId},
          ${documentSectionId},
          ${input.sourceId},
          ${chunk.chunkIndex},
          ${chunk.originalText},
          ${chunk.chunkHash},
          ${section.sectionKey},
          ${section.sectionTitle},
          ${input.documentTitle},
          ${input.sourceInstitution},
          ${input.publishedAt ?? null},
          ${input.updatedAt ?? null},
          ${textArray(db, section.applicablePopulations)},
          ${textArray(db, section.scenarioTags)},
          ${section.answerEligible ?? true},
          ${json(db, section.metadata ?? {})}
        )
      `;
    }
  }

  return sourceDocumentId;
}

export async function upsertEntityMapping(
  db: AdminClient,
  input: {
    entityType: string;
    canonicalName: string;
    mappingType: string;
    system: string;
    code?: string;
    value: string;
    standardName?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const entityRows = await db<{ id: string }[]>`
    select id
    from public.medical_entities
    where entity_type = ${input.entityType}
      and canonical_name = ${input.canonicalName}
    limit 1
  `;

  const entity = entityRows[0];
  if (!entity) {
    return;
  }

  if (input.code) {
    await db`
      delete from public.entity_mappings
      where entity_id = ${entity.id}
        and mapping_type = ${input.mappingType}
        and system = ${input.system}
        and code = ${input.code}
        and value = ${input.value}
    `;
  } else {
    await db`
      delete from public.entity_mappings
      where entity_id = ${entity.id}
        and mapping_type = ${input.mappingType}
        and system = ${input.system}
        and code is null
        and value = ${input.value}
    `;
  }

  await db`
    insert into public.entity_mappings (
      entity_id,
      mapping_type,
      system,
      code,
      value,
      standard_name,
      metadata
    ) values (
      ${entity.id},
      ${input.mappingType},
      ${input.system},
      ${input.code ?? null},
      ${input.value},
      ${input.standardName ?? null},
      ${json(db, input.metadata ?? {})}
    )
  `;
}

export async function linkScenarioSourcesForDocument(
  db: AdminClient,
  sourceDocumentId: string,
  scenarioTags: readonly string[],
  medicineNames: readonly string[] = [],
) {
  for (const scenarioTag of scenarioTags) {
    const scenarioRows = await db<{ id: string }[]>`
      select id
      from public.medical_entities
      where entity_type = 'scenario'
        and canonical_name = ${scenarioTag}
      limit 1
    `;

    const scenario = scenarioRows[0];
    if (!scenario) {
      continue;
    }

    for (const medicineName of medicineNames.length > 0 ? medicineNames : [""]) {
      let medicalEntityId: string | null = null;

      if (medicineName) {
        const medicineRows = await db<{ id: string }[]>`
          select id
          from public.medical_entities
          where entity_type = 'drug'
            and canonical_name = ${medicineName}
          limit 1
        `;

        medicalEntityId = medicineRows[0]?.id ?? null;
      }

      if (medicalEntityId) {
        await db`
          delete from public.scenario_sources
          where scenario_entity_id = ${scenario.id}
            and medical_entity_id = ${medicalEntityId}
            and source_document_id = ${sourceDocumentId}
        `;
      } else {
        await db`
          delete from public.scenario_sources
          where scenario_entity_id = ${scenario.id}
            and medical_entity_id is null
            and source_document_id = ${sourceDocumentId}
        `;
      }

      await db`
        insert into public.scenario_sources (
          scenario_entity_id,
          medical_entity_id,
          source_document_id,
          relevance,
          metadata
        ) values (
          ${scenario.id},
          ${medicalEntityId},
          ${sourceDocumentId},
          'supporting',
          ${json(db, { stage: "minimal_kb" })}
        )
      `;
    }
  }
}
