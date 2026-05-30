# CareGuide AI Deployment

CareGuide AI is a non-commercial portfolio project: a C-end "what medicine should I take" AI doctor demo that performs basic symptom triage, shows medication cards, and clearly warns that AI output is not a professional diagnosis.

## GitHub Repository

https://github.com/sagiistar-prog/careguide-ai

## Vercel Import Steps

1. Open Vercel and choose **Add New Project**.
2. Import `sagiistar-prog/careguide-ai` from GitHub.
3. In project settings, set **Root Directory** to `apps/web`.
4. Keep **Framework Preset** as `Next.js`.
5. Set **Install Command** to `npm install`.
6. Set **Build Command** to `npm run build`.
7. Add the required environment variables below.
8. Deploy, then run the production smoke test before using the demo.

## Vercel Project Settings

- Root Directory: `apps/web`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`

For better database latency, choose a Vercel Function region close to the Supabase database region when the plan allows it.

## Required Environment Variables

Server-only variables:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_EMBEDDING_DIMENSION`
- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENFDA_API_KEY`
- `NHS_WEBSITE_CONTENT_API_KEY`

Public browser variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not prefix server-only variables with `NEXT_PUBLIC_`. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are intended to be visible to the frontend.

## Post-deploy Smoke Test

After deployment, set the deployed URL locally and run:

```powershell
$env:CAREGUIDE_BASE_URL="https://your-vercel-project.vercel.app"
npm run prod:smoke
```

The smoke test checks:

- `GET /api/health`
- `GET /api/scenarios`
- `GET /api/kb/coverage`
- `POST /api/query`

The query test cases cover a mild cold query, a pediatric fever medication information query, and a red-flag chest-pain query. The script prints only status-level information, answer status, citation coverage, and whether medication cards exist. It does not print full medical answers or secrets.

You can also open `/api/health` directly before a portfolio demo to confirm startup, environment presence, and database connectivity.

## Stability Notes

- Keep API routes on the Node.js runtime because the current app uses Node libraries and database connections.
- `/api/query` has a longer function duration budget for Gemini and database work.
- Gemini calls must keep timeout and fallback behavior so slow model responses do not break the whole demo.
- External retrieval supplements should fail softly. Local evidence and medication cards should remain available when external APIs are unavailable.
- `/api/health` never calls external medical APIs and never returns keys, connection strings, service-role values, or medical text.

## Common Failures

- Build cannot find dependencies: confirm the Vercel Root Directory is `apps/web`, then redeploy with `npm install` and `npm run build`.
- Missing environment variable: check Vercel Project Settings > Environment Variables and confirm all required variable names exist for Production.
- Supabase connection fails: confirm `DATABASE_URL` is configured server-side, Supabase is reachable, and the Vercel region is close to the database region.
- Gemini request times out: confirm the Gemini variables exist, model names are valid, and the query route has enough function duration for the selected Vercel plan.
- Public Supabase variables missing in browser flows: confirm only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` use the `NEXT_PUBLIC_` prefix.
- Production smoke test fails before requests: confirm `CAREGUIDE_BASE_URL` is set to the deployed site origin, without a trailing path.
