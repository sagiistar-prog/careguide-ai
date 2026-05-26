# CareGuide AI Ingestion Plan

## Stage 1 Goal

Stage 1 builds a minimal real knowledge base, not a full production medical knowledge base. It does not use ordinary mock medical data and does not generate medical answers with Gemini.

The goal is to prove the ingestion foundation:

1. Fetch from free official APIs.
2. Store raw source records.
3. Normalize source metadata.
4. Prepare document sections and chunks.
5. Prepare keyword and vector indexing hooks.
6. Preserve citation fields needed by future evidence cards.

This stage is about source ingestion and local persistence only. It is not the answer-generation stage.

## First Scenarios

Only these scenarios are in scope for the first import stage:

- 感冒发热.
- 儿童退烧.
- 高血压.
- 糖尿病.

## First Data Sources

Allowed first-stage sources:

- DailyMed.
- openFDA Drug Label.
- openFDA NDC Directory.
- openFDA Drug Enforcement.
- RxNorm.
- RxTerms.
- RxClass.
- MedlinePlus Connect.
- NHS Website Content API.

Forbidden in this stage:

- DrugBank.
- GoodRx.
- Commercial interaction databases.
- Unauthorized Chinese guideline libraries.
- Paid papers or paid database full text.
- Non-official websites.

## Runtime Boundary

External official APIs are backend-only. They may be used for:

- Background ingestion.
- Drug name and ingredient normalization.
- Source updates.
- Local knowledge base construction.
- Future scheduled refresh jobs.

They must not be used for:

- User-facing live medical queries.
- Frontend runtime lookup.
- Real-time answer generation.
- Filling missing evidence.

External APIs are raw material entrances, not answer exits.

During user questions, the app may query only:

- Supabase PostgreSQL.
- Local PostgreSQL full-text search.
- pgvector vector index.
- Locally stored source records and chunks.

## Gemini Boundary

Gemini is not a medical source. It may only receive a local `evidence_package` assembled from local retrieval, or local official-text chunks for embedding. It must not browse, search, call URL context tools, or answer from model memory.

If the local evidence package has no source chunk, no Gemini medical explanation should be requested.

## Local Hybrid Retrieval Stage

The local retrieval stage has been added after minimal ingestion and chunk embedding. It uses only local database tables:

- `source_chunks` for original citation-ready text and PostgreSQL full-text search.
- `chunk_embeddings` for pgvector semantic search.
- `medical_entities` and `entity_mappings` for rule-based query normalization.
- `evidence_packages` for persisted retrieval output.

User-style queries must not call external medical data APIs in this stage. Gemini is used only to create a query embedding for semantic retrieval. It does not generate medical facts, does not browse, and does not fill missing evidence.

The retrieval pipeline is:

1. Normalize the query with local entities and rules.
2. Run PostgreSQL full-text search.
3. Run pgvector semantic search when query embedding is available.
4. Fuse candidates with Reciprocal Rank Fusion.
5. Rerank with citation safety, section intent, population relevance, and source metadata rules.
6. Persist an `evidence_package`.

The output is evidence only. It is not a diagnosis, prescription, medication recommendation, or natural-language medical answer.

## Structured Explanation Stage

The structured explanation stage converts a saved local `evidence_package` into JSON. Gemini is used only as a language organization tool. It is not allowed to browse, call external APIs, use model memory for medical facts, or fill gaps in the local evidence package.

Safety rules for this stage:

- Every medical sentence must include local `citation_ids`, `source_ids`, and `chunk_ids`.
- The citation validator removes or replaces unsupported medical claims with `当前知识库无法确认`.
- Citation audits are written to `answer_sentences` and `citation_audits`.
- High-risk questions are routed to `needs_professional_confirmation`.
- The system must not output diagnosis, prescription, or personalized medication instructions.

The output remains a structured evidence explanation. It is not a clinical decision, prescription, or individualized treatment plan.

## Backend API Route Stage

The backend API stage exposes internal Next.js route handlers for the future frontend workbench:

- `POST /api/query` runs local hybrid retrieval, creates an evidence package, asks Gemini only to organize that evidence into JSON, validates citations, and returns a safe trimmed response.
- `GET /api/evidence/[id]` returns a safe citation or evidence-package source excerpt.
- `GET /api/sources/[sourceId]` returns source metadata.
- `GET /api/scenarios` returns the four MVP scenarios and coverage counts.
- `GET /api/kb/coverage` returns minimal knowledge base coverage.

Frontend code must not call external medical data APIs, Gemini, Supabase service role, or the database directly. All frontend-visible medical content must come from the API response after citation validation.

## Connector Foundation

The official API foundation lives under:

`apps/web/src/lib/official-api`

Initial responsibilities:

- Unified base URL handling.
- Unified timeout.
- Structured success, empty, and error results.
- Per-source rate limit configuration.
- 429 handling with `Retry-After` or exponential backoff.
- Import run metadata placeholder.
- Raw payload hash placeholder.
- Future `raw_source_records` persistence placeholder.
- No secret logging.

## Future Import Pipeline

The next stage should add backend scripts under `apps/web/scripts/ingest`:

1. `fetch`: call allowed official APIs through connectors.
2. `snapshot`: store raw payloads with hash and `import_run_id`.
3. `normalize`: map source metadata and medical entities.
4. `sectionize`: split labels and education pages into meaningful sections.
5. `chunk`: create citation-ready source chunks.
6. `index`: generate full-text vectors and embedding records.
7. `validate`: verify every chunk has source metadata needed for future evidence cards.

## Required Citation Fields

Every chunk intended for future user-facing evidence must preserve:

- `source_id`.
- Original excerpt.
- Document title.
- Source institution.
- Publication date or update date.
- Version when available.
- Source URL or canonical identifier.
- Section name.
- Import run id.
- Raw payload hash or document hash.
