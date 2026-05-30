import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";
export const maxDuration = 10;

const REQUIRED_ENV = {
  gemini: ["GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_DIMENSION"],
  supabase: ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  officialApis: ["OPENFDA_API_KEY", "NHS_WEBSITE_CONTENT_API_KEY"],
} as const;

function hasValue(key: string) {
  const value = process.env[key];

  return typeof value === "string" && value.trim().length > 0 && !/^your_/i.test(value);
}

function groupPresent(keys: readonly string[]) {
  return keys.every(hasValue);
}

function countValue(rows: Array<{ count: string | number }>) {
  return Number(rows[0]?.count ?? 0);
}

async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    return {
      status: "missing_env" as const,
      counts: null,
    };
  }

  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 5,
    max: 1,
  });

  try {
    const sourceDocuments = countValue(
      await sql`select count(*) from public.source_documents`,
    );
    const sourceChunks = countValue(
      await sql`select count(*) from public.source_chunks`,
    );
    const medicalEntities = countValue(
      await sql`select count(*) from public.medical_entities`,
    );

    return {
      status: "ok" as const,
      counts: {
        source_documents: sourceDocuments,
        source_chunks: sourceChunks,
        medical_entities: medicalEntities,
      },
    };
  } catch {
    return {
      status: "failed" as const,
      counts: null,
    };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function GET() {
  const database = await checkDatabase();
  const env = {
    gemini: groupPresent(REQUIRED_ENV.gemini),
    supabase: groupPresent(REQUIRED_ENV.supabase),
    officialApis: groupPresent(REQUIRED_ENV.officialApis),
  };
  const healthy = database.status === "ok" && env.gemini && env.supabase;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      app: "CareGuide AI",
      time: new Date().toISOString(),
      database: database.status,
      env,
      counts: database.counts,
    },
    {
      status: healthy ? 200 : 200,
    },
  );
}
