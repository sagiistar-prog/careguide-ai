import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const REQUIRED_ENV_KEYS = [
  "GEMINI_API_KEY",
  "OPENFDA_API_KEY",
  "NHS_WEBSITE_CONTENT_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DAILYMED_BASE_URL",
  "OPENFDA_BASE_URL",
  "RXNAV_BASE_URL",
  "MEDLINEPLUS_CONNECT_BASE_URL",
  "NHS_WEBSITE_CONTENT_BASE_URL",
] as const;

const DEFAULTS = {
  GEMINI_MODEL: "gemini-2.5-flash",
  GEMINI_EMBEDDING_MODEL: "gemini-embedding-2",
  GEMINI_EMBEDDING_DIMENSION: 768,
};

function isMissing(value: string | undefined) {
  return (
    value == null ||
    value.trim() === "" ||
    /^your_/i.test(value.trim()) ||
    /^replace_/i.test(value.trim())
  );
}

export function assertRequiredScriptEnv() {
  const missing = REQUIRED_ENV_KEYS.filter((key) => isMissing(process.env[key]));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(
        ", ",
      )}. Values are intentionally not printed.`,
    );
  }
}

export function getScriptEnv() {
  assertRequiredScriptEnv();
  const embeddingDimension = Number(
    process.env.GEMINI_EMBEDDING_DIMENSION ||
      DEFAULTS.GEMINI_EMBEDDING_DIMENSION,
  );

  if (!Number.isInteger(embeddingDimension) || embeddingDimension <= 0) {
    throw new Error(
      "GEMINI_EMBEDDING_DIMENSION must be a positive integer. Value was not printed.",
    );
  }

  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    GEMINI_MODEL: process.env.GEMINI_MODEL || DEFAULTS.GEMINI_MODEL,
    GEMINI_EMBEDDING_MODEL:
      process.env.GEMINI_EMBEDDING_MODEL ||
      DEFAULTS.GEMINI_EMBEDDING_MODEL,
    GEMINI_EMBEDDING_DIMENSION: embeddingDimension,
    OPENFDA_API_KEY: process.env.OPENFDA_API_KEY!,
    NHS_WEBSITE_CONTENT_API_KEY: process.env.NHS_WEBSITE_CONTENT_API_KEY!,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    DATABASE_URL: process.env.DATABASE_URL!,
    DAILYMED_BASE_URL: process.env.DAILYMED_BASE_URL!,
    OPENFDA_BASE_URL: process.env.OPENFDA_BASE_URL!,
    RXNAV_BASE_URL: process.env.RXNAV_BASE_URL!,
    MEDLINEPLUS_CONNECT_BASE_URL:
      process.env.MEDLINEPLUS_CONNECT_BASE_URL!,
    NHS_WEBSITE_CONTENT_BASE_URL:
      process.env.NHS_WEBSITE_CONTENT_BASE_URL!,
  };
}
