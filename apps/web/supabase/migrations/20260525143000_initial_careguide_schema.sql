do $$
begin
  create extension if not exists pgcrypto;
exception
  when duplicate_object then
    null;
  when insufficient_privilege then
    if to_regprocedure('gen_random_uuid()') is null then
      raise exception 'The pgcrypto extension or gen_random_uuid() is required. Enable pgcrypto in Supabase Dashboard before running this migration.';
    end if;
end $$;

do $$
begin
  create schema if not exists extensions;
exception
  when insufficient_privilege then
    null;
end $$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions') then
    create extension if not exists vector with schema extensions;
  else
    create extension if not exists vector;
  end if;
exception
  when duplicate_object then
    null;
  when insufficient_privilege then
    if to_regtype('vector') is null and to_regtype('extensions.vector') is null then
      raise exception 'The pgvector extension is required. Enable vector in Supabase Dashboard before running this migration.';
    end if;
end $$;

create table if not exists public.source_connectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  official_organization text not null,
  base_url text not null,
  source_family text not null default 'medical',
  is_official boolean not null default true,
  free_for_demo boolean not null default true,
  runtime_allowed boolean not null default false,
  api_key_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_connectors_external_runtime_block
    check (source_family <> 'medical' or runtime_allowed = false)
);

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid references public.source_connectors(id) on delete set null,
  run_type text not null default 'minimal_kb',
  status text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  empty_count integer not null default 0 check (empty_count >= 0),
  error_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.raw_source_records (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.source_connectors(id) on delete restrict,
  import_run_id uuid references public.import_runs(id) on delete set null,
  external_id text,
  source_url text,
  request_url text,
  status_code integer,
  content_type text,
  payload_json jsonb,
  raw_text text,
  payload_hash text not null,
  empty boolean not null default false,
  error jsonb,
  retrieved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists raw_source_records_connector_hash_idx
  on public.raw_source_records(connector_id, payload_hash);

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.source_connectors(id) on delete restrict,
  raw_source_record_id uuid references public.raw_source_records(id) on delete set null,
  source_id text not null unique,
  external_id text,
  document_title text not null,
  source_institution text not null,
  source_type text not null,
  source_url text,
  published_at date,
  source_updated_at date,
  version text,
  license_note text,
  country_region text,
  disease_area text[] not null default '{}',
  medicine_names text[] not null default '{}',
  ingredient_names text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_documents_connector_idx
  on public.source_documents(connector_id);

create index if not exists source_documents_source_type_idx
  on public.source_documents(source_type);

create index if not exists source_documents_dates_idx
  on public.source_documents(published_at, source_updated_at);

create index if not exists source_documents_medicines_idx
  on public.source_documents using gin(medicine_names);

create index if not exists source_documents_disease_area_idx
  on public.source_documents using gin(disease_area);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  raw_source_record_id uuid references public.raw_source_records(id) on delete set null,
  version_label text,
  published_at date,
  updated_at date,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_document_id, content_hash)
);

create table if not exists public.document_sections (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  document_version_id uuid references public.document_versions(id) on delete set null,
  section_key text not null,
  section_title text not null,
  original_text text not null check (length(trim(original_text)) > 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_sections_document_idx
  on public.document_sections(source_document_id, section_key);

create table if not exists public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  document_section_id uuid not null references public.document_sections(id) on delete cascade,
  source_id text not null,
  chunk_index integer not null check (chunk_index >= 0),
  original_text text not null check (length(trim(original_text)) > 0),
  chunk_hash text not null unique,
  section_key text not null,
  section_title text not null,
  source_title text not null,
  source_organization text not null,
  published_at date,
  updated_at date,
  applicable_populations text[] not null default '{}',
  scenario_tags text[] not null default '{}',
  answer_eligible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(section_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(original_text, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  constraint source_chunks_source_id_document_match
    foreign key (source_id) references public.source_documents(source_id) on delete cascade,
  constraint source_chunks_answer_requires_date
    check (answer_eligible = false or published_at is not null or updated_at is not null)
);

create index if not exists source_chunks_document_idx
  on public.source_chunks(source_document_id);

create index if not exists source_chunks_section_idx
  on public.source_chunks(section_key);

create index if not exists source_chunks_scenarios_idx
  on public.source_chunks using gin(scenario_tags);

create index if not exists source_chunks_populations_idx
  on public.source_chunks using gin(applicable_populations);

create index if not exists source_chunks_search_idx
  on public.source_chunks using gin(search_vector);

create table if not exists public.chunk_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.source_chunks(id) on delete cascade,
  embedding vector(__GEMINI_EMBEDDING_DIMENSION__) not null,
  embedding_model text not null,
  dimension integer not null check (dimension = __GEMINI_EMBEDDING_DIMENSION__),
  task_type text not null default 'retrieval_document',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(chunk_id, embedding_model)
);

create index if not exists chunk_embeddings_chunk_idx
  on public.chunk_embeddings(chunk_id);

create index if not exists chunk_embeddings_vector_hnsw_idx
  on public.chunk_embeddings using hnsw (embedding vector_cosine_ops);

create table if not exists public.medical_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('drug', 'ingredient', 'disease', 'scenario', 'population', 'drug_class')),
  canonical_name text not null,
  display_name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, canonical_name)
);

create index if not exists medical_entities_type_idx
  on public.medical_entities(entity_type);

create index if not exists medical_entities_canonical_idx
  on public.medical_entities(canonical_name);

create table if not exists public.entity_mappings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.medical_entities(id) on delete cascade,
  mapping_type text not null,
  system text not null,
  code text,
  value text not null,
  standard_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entity_mappings_entity_idx
  on public.entity_mappings(entity_id);

create index if not exists entity_mappings_system_code_idx
  on public.entity_mappings(system, code);

create index if not exists entity_mappings_value_idx
  on public.entity_mappings(value);

create table if not exists public.scenario_sources (
  id uuid primary key default gen_random_uuid(),
  scenario_entity_id uuid not null references public.medical_entities(id) on delete cascade,
  medical_entity_id uuid references public.medical_entities(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete cascade,
  source_chunk_id uuid references public.source_chunks(id) on delete cascade,
  relevance text not null default 'supporting',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint scenario_sources_requires_scenario
    check (scenario_entity_id is not null)
);

create index if not exists scenario_sources_scenario_idx
  on public.scenario_sources(scenario_entity_id);

create index if not exists scenario_sources_entity_idx
  on public.scenario_sources(medical_entity_id);

create index if not exists scenario_sources_document_idx
  on public.scenario_sources(source_document_id);

create index if not exists scenario_sources_chunk_idx
  on public.scenario_sources(source_chunk_id);

create table if not exists public.evidence_packages (
  id uuid primary key default gen_random_uuid(),
  scenario_entity_id uuid references public.medical_entities(id) on delete set null,
  query_text text,
  status text not null default 'created'
    check (status in ('created', 'ready_for_llm', 'insufficient_evidence', 'blocked', 'validated', 'failed')),
  retrieved_chunk_ids uuid[] not null default '{}',
  package_json jsonb not null default '{}'::jsonb,
  validation_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.answer_sentences (
  id uuid primary key default gen_random_uuid(),
  evidence_package_id uuid not null references public.evidence_packages(id) on delete cascade,
  sentence_index integer not null check (sentence_index >= 0),
  sentence_text text not null,
  claim_type text not null,
  citation_ids uuid[] not null default '{}',
  source_ids text[] not null default '{}',
  valid boolean not null default false,
  validation_error text,
  created_at timestamptz not null default now(),
  constraint answer_sentences_medical_claim_requires_citation
    check (
      claim_type not in (
        'medication_use',
        'contraindication',
        'warning',
        'population',
        'child',
        'older_adult',
        'pregnancy',
        'lactation',
        'dose',
        'side_effect',
        'interaction',
        'adverse_reaction'
      )
      or cardinality(citation_ids) > 0
    )
);

create index if not exists answer_sentences_package_idx
  on public.answer_sentences(evidence_package_id);

create table if not exists public.citation_audits (
  id uuid primary key default gen_random_uuid(),
  evidence_package_id uuid references public.evidence_packages(id) on delete cascade,
  answer_sentence_id uuid references public.answer_sentences(id) on delete cascade,
  status text not null
    check (status in ('passed', 'failed', 'warning')),
  missing_fields text[] not null default '{}',
  audit_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists citation_audits_package_idx
  on public.citation_audits(evidence_package_id);

create index if not exists citation_audits_sentence_idx
  on public.citation_audits(answer_sentence_id);
