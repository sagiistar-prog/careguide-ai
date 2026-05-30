# CareGuide AI Desktop Shell

This is a minimal Tauri shell plan for a Windows EXE portfolio demo. It does not contain API keys and should only open the deployed CareGuide AI web app.

## Configuration

Set the online app URL before running or building:

```powershell
$env:CAREGUIDE_APP_URL="https://careguide-ai-three.vercel.app"
```

If `CAREGUIDE_APP_URL` is not set, the shell falls back to `https://careguide-ai-three.vercel.app`.

## Notes

- Do not put Gemini, Supabase, OpenFDA, NHS, database, or service-role keys in this app.
- The desktop app requires internet access.
- The backend remains Vercel and Supabase.
- This folder is intentionally separate from `apps/web` and should not affect the web build.

## Future Build

Rustup is required for packaging. From the repository root:

```powershell
npm install
$env:CAREGUIDE_APP_URL="https://careguide-ai-three.vercel.app"
npm --workspace apps/desktop run build
```

The generated Windows installer is written under `apps/desktop/src-tauri/target/release/bundle/nsis/` when the local Windows build prerequisites are present.
