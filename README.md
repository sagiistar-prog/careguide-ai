# CareGuide AI

CareGuide AI is a non-commercial family medication evidence workbench. Medical content must come from approved official sources imported into the local knowledge base. User-facing queries must not call external medical APIs in real time.

## Project Structure

- `apps/web`: Next.js, TypeScript, Tailwind CSS application.
- `PRODUCT.md`: product and safety boundaries.
- `DESIGN.md`: interface and UX design direction.
- `DATA_SOURCES.md`: allowed and forbidden source policy.
- `INGESTION_PLAN.md`: first-stage ingestion plan.

## Local Setup

Install dependencies:

```powershell
npm install
```

Create the app environment file:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Then fill the values in `apps/web/.env.local` on your machine. Do not paste real keys into README files, docs, tests, screenshots, or logs.

Required server-only variables:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_EMBEDDING_DIMENSION`
- `OPENFDA_API_KEY`
- `NHS_WEBSITE_CONTENT_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

Public browser-safe Supabase variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Non-secret official API base URL configuration:

- `DAILYMED_BASE_URL`
- `OPENFDA_BASE_URL`
- `RXNAV_BASE_URL`
- `MEDLINEPLUS_CONNECT_BASE_URL`
- `NHS_WEBSITE_CONTENT_BASE_URL`

Check that required variables exist without printing values:

```powershell
npm run env:check
```

Start the local app:

```powershell
npm run dev
```

The app runs from `apps/web`.

## Database Setup

Migration files live in `apps/web/supabase/migrations`.

Run migrations:

```powershell
npm run db:migrate
```

Run seed data:

```powershell
npm run db:seed
```

These commands use `DATABASE_URL` from `apps/web/.env.local` and do not print the connection string. If direct database access is unavailable, copy the SQL from `apps/web/supabase/migrations` and `apps/web/supabase/seed.sql` into the Supabase dashboard SQL editor. The Supabase CLI is optional for this stage.

## Minimal Real Knowledge Base

Run the first-stage official-source import:

```powershell
npm run ingest:minimal
```

This imports a small real knowledge base for:

- 感冒发热
- 儿童退烧
- 高血压
- 糖尿病

Create embeddings for locally stored chunks:

```powershell
npm run embed:chunks
```

If your machine needs a proxy for Gemini embedding calls, you can temporarily set `NODE_USE_ENV_PROXY=1` in PowerShell before running embedding or retrieval commands:

```powershell
$env:NODE_USE_ENV_PROXY='1'
```

If Gemini returns `429` while creating embeddings, continue later with a smaller batch size or a longer delay:

```powershell
$env:NODE_USE_ENV_PROXY='1'
$env:GEMINI_EMBEDDING_BATCH_SIZE='5'
$env:GEMINI_EMBEDDING_DELAY_MS='15000'
$env:GEMINI_EMBEDDING_RETRY_DELAY_MS='60000'
npm run embed:chunks
```

The embedding script skips chunks that already have embeddings. It logs only safe counts such as total chunks, existing embeddings, new embeddings, remaining missing chunks, model, and dimension.

Verify the minimal knowledge base:

```powershell
npm run verify:kb
```

These scripts must not print secret values. They may print counts, statuses, and import run ids.

## Local Hybrid Retrieval

The current local retrieval stage uses PostgreSQL full-text search, pgvector semantic search, Reciprocal Rank Fusion, rule-based evidence reranking, and an `evidence_package` record. It does not call DailyMed, openFDA, RxNav, MedlinePlus, NHS, or any external medical data API during user-style queries.

Gemini is used only to embed the query text for vector search. It is not used to generate medical facts or medication advice in this stage.

Run the safe retrieval test:

```powershell
npm run retrieval:test
```

Verify retrieval safety:

```powershell
npm run verify:retrieval
```

The retrieval output is an evidence package, not a medical answer. The next stage will use this package for structured explanation and citation validation.

## Structured Evidence Explanation

CareGuide AI can now convert a local `evidence_package` into a structured JSON explanation. Gemini is not a medical knowledge source in this stage. It receives only the local evidence package and is used only to organize source-backed language for ordinary users.

Run the answer generation smoke test:

```powershell
npm run answer:test
```

Run answer safety verification:

```powershell
npm run verify:answer
```

Every medical sentence must pass citation validation with local `citation_ids`, `source_ids`, and `chunk_ids`. High-risk questions are routed to professional confirmation prompts and must not produce diagnosis, prescription, or personalized medication instructions.

## Backend API Routes

The backend API route stage wraps local retrieval and structured explanation for the future frontend workbench. The frontend calls only internal Next.js routes:

- `POST /api/query`
- `GET /api/evidence/[id]`
- `GET /api/sources/[sourceId]`
- `GET /api/scenarios`
- `GET /api/kb/coverage`

External medical data APIs remain backend import-only. Gemini is never exposed to the frontend and can only receive the local evidence package. API responses are trimmed to frontend-safe fields and must not include secrets, raw Gemini requests, database URLs, service role keys, or internal logs.

Run API route verification:

```powershell
npm run api:test
```

## Frontend Workbench

The homepage `/` is the CareGuide AI family medication workbench. It calls only internal API routes:

- `GET /api/scenarios`
- `GET /api/kb/coverage`
- `POST /api/query`
- `GET /api/evidence/[id]`
- `GET /api/sources/[sourceId]`

The frontend does not call Gemini, Supabase service role, DailyMed, openFDA, RxNav, MedlinePlus, NHS, or any external medical data API. Medical text shown in the workbench comes from backend structured results after citation validation.

Run local frontend checks:

```powershell
npm run typecheck
npm run build
npm run ui:smoke
```

Start the workbench:

```powershell
npm run dev
```

Then open `http://localhost:3000`.

## Secret Handling Rules

- Never commit `apps/web/.env.local`.
- Do not create `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_OPENFDA_API_KEY`, or `NEXT_PUBLIC_NHS_WEBSITE_CONTENT_API_KEY`.
- Do not add `NEXT_PUBLIC_` to Gemini, openFDA, NHS, Supabase service role, or database secrets.
- Frontend components must not read server-only keys directly.
- Official medical API calls must run through backend import scripts or server route handlers only.
- User-facing queries must use the local database, local full-text index, and pgvector index.
- Gemini may only receive the local RAG evidence package, or locally stored chunks for embedding. It must not browse, search, or use model memory for medical facts.
