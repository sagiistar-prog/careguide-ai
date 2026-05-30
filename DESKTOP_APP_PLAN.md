# CareGuide AI Desktop App Plan

This plan keeps the current web app intact and treats the Windows EXE as a portfolio-friendly shell around the deployed CareGuide AI site. No API keys should be placed in the desktop client.

## Option A: Tauri Desktop Shell (Recommended)

Purpose: package a lightweight Windows EXE that opens the live Vercel CareGuide AI site.

Advantages:

- Lightweight compared with Electron.
- Good fit for a portfolio demo because it feels like a real desktop app without duplicating backend work.
- Keeps all sensitive keys on Vercel and Supabase, not inside the client.
- Allows the web app to remain the single product surface.

Limitations:

- Requires internet access.
- Backend still runs on Vercel and Supabase.
- Requires Rust and Tauri tooling only when building the EXE locally.

## Option B: Electron Desktop Shell

Purpose: package a Windows desktop app that opens the same live CareGuide AI site.

Advantages:

- Mature ecosystem and familiar desktop packaging workflow.
- Easier for many JavaScript teams to customize.

Limitations:

- Larger app size and heavier memory footprint.
- Still needs internet access when it wraps the online site.
- Sensitive keys must still remain server-side.

## Option C: True Offline Version

Purpose: run CareGuide AI locally without depending on Vercel, Supabase, or online model calls.

Recommendation: not recommended at the current portfolio stage.

Reasons:

- Requires a local database.
- Requires local vector retrieval and packaging of the knowledge base.
- Requires either a local model or a secure cloud proxy.
- Creates a much larger engineering, QA, and medical safety scope than the current demo needs.

## Recommended Next Step

Use Option A. Build a Tauri shell that loads the deployed Vercel URL through a configurable `CAREGUIDE_APP_URL`, while keeping diagnosis, retrieval, Gemini calls, Supabase access, and all secrets on the server.
