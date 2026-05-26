import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { getScriptEnv } from "../ingest/lib/script-env";

function safeDatabaseError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code);

    if (code === "28P01") {
      return "Database authentication failed. Possible cause: DATABASE_URL password or user is incorrect.";
    }

    if (code === "42P01") {
      return "Seed failed because required tables are missing. Run migration first.";
    }
  }

  return "Seed failed. Check database access, schema state, and permissions.";
}

async function main() {
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
  });

  try {
    const seedPath = path.join(process.cwd(), "supabase", "seed.sql");
    const seedSql = await readFile(seedPath, "utf8");
    await sql.unsafe(seedSql);
    console.log("Seed complete. Values were not printed.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(safeDatabaseError(error));

  process.exit(1);
});
