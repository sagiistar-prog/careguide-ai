import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const REQUIRED_ENV_KEYS = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
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

const OPTIONAL_DEFAULTED_ENV_KEYS = [
  "GEMINI_EMBEDDING_MODEL",
  "GEMINI_EMBEDDING_DIMENSION",
] as const;

function isMissing(value: string | undefined) {
  return (
    value == null ||
    value.trim() === "" ||
    /^your_/i.test(value.trim()) ||
    /^replace_/i.test(value.trim())
  );
}

try {
  const missing = REQUIRED_ENV_KEYS.filter((key) => isMissing(process.env[key]));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(
        ", ",
      )}. Values were not printed.`,
    );
  }

  const embeddingDimension = Number(
    process.env.GEMINI_EMBEDDING_DIMENSION || 768,
  );

  if (!Number.isInteger(embeddingDimension) || embeddingDimension <= 0) {
    throw new Error(
      "GEMINI_EMBEDDING_DIMENSION must be a positive integer. Value was not printed.",
    );
  }

  console.log(
    `Environment check passed: required variables are present and optional defaults are supported. Values were not printed. Optional keys: ${OPTIONAL_DEFAULTED_ENV_KEYS.join(", ")}`,
  );
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Environment check failed.");
  }

  process.exit(1);
}
