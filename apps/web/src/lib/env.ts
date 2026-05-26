type EnvMap = Record<string, string | undefined>;

export const SERVER_SECRET_ENV_KEYS = [
  "GEMINI_API_KEY",
  "OPENFDA_API_KEY",
  "NHS_WEBSITE_CONTENT_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

export const SERVER_CONFIG_ENV_KEYS = [
  "GEMINI_MODEL",
  "GEMINI_EMBEDDING_MODEL",
  "GEMINI_EMBEDDING_DIMENSION",
  "DAILYMED_BASE_URL",
  "OPENFDA_BASE_URL",
  "RXNAV_BASE_URL",
  "MEDLINEPLUS_CONNECT_BASE_URL",
  "NHS_WEBSITE_CONTENT_BASE_URL",
] as const;

export const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export type ServerEnv = Readonly<{
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  GEMINI_EMBEDDING_MODEL: string;
  GEMINI_EMBEDDING_DIMENSION: number;
  OPENFDA_API_KEY: string;
  NHS_WEBSITE_CONTENT_API_KEY: string;
  DAILYMED_BASE_URL: string;
  OPENFDA_BASE_URL: string;
  RXNAV_BASE_URL: string;
  MEDLINEPLUS_CONNECT_BASE_URL: string;
  NHS_WEBSITE_CONTENT_BASE_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DATABASE_URL: string;
}>;

export type ServerEnvOptions = {
  requireSupabase?: boolean;
};

const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^your_/i,
  /^replace_/i,
  /^changeme$/i,
  /^todo$/i,
  /^<.*>$/,
];

function isMissing(value: string | undefined) {
  if (value == null) {
    return true;
  }

  const trimmed = value.trim();
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function readRequired(env: EnvMap, keys: readonly string[]) {
  const missing = keys.filter((key) => isMissing(env[key]));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(
        ", ",
      )}. Add them to apps/web/.env.local. Values are intentionally not printed.`,
    );
  }
}

function readEmbeddingDimension(env: EnvMap) {
  const dimension = Number(env.GEMINI_EMBEDDING_DIMENSION || 768);

  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error(
      "GEMINI_EMBEDDING_DIMENSION must be a positive integer. Value was not printed.",
    );
  }

  return dimension;
}

function assertNotBrowserRuntime() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Server environment variables cannot be read in browser components.",
    );
  }
}

export function getServerEnv(options: ServerEnvOptions = {}): ServerEnv {
  assertNotBrowserRuntime();

  const env = process.env;

  readRequired(env, [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "OPENFDA_API_KEY",
    "NHS_WEBSITE_CONTENT_API_KEY",
    "DAILYMED_BASE_URL",
    "OPENFDA_BASE_URL",
    "RXNAV_BASE_URL",
    "MEDLINEPLUS_CONNECT_BASE_URL",
    "NHS_WEBSITE_CONTENT_BASE_URL",
  ]);

  if (options.requireSupabase) {
    readRequired(env, [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "DATABASE_URL",
    ]);
  }

  return {
    GEMINI_API_KEY: env.GEMINI_API_KEY!,
    GEMINI_MODEL: env.GEMINI_MODEL!,
    GEMINI_EMBEDDING_MODEL:
      env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    GEMINI_EMBEDDING_DIMENSION: readEmbeddingDimension(env),
    OPENFDA_API_KEY: env.OPENFDA_API_KEY!,
    NHS_WEBSITE_CONTENT_API_KEY: env.NHS_WEBSITE_CONTENT_API_KEY!,
    DAILYMED_BASE_URL: env.DAILYMED_BASE_URL!,
    OPENFDA_BASE_URL: env.OPENFDA_BASE_URL!,
    RXNAV_BASE_URL: env.RXNAV_BASE_URL!,
    MEDLINEPLUS_CONNECT_BASE_URL: env.MEDLINEPLUS_CONNECT_BASE_URL!,
    NHS_WEBSITE_CONTENT_BASE_URL: env.NHS_WEBSITE_CONTENT_BASE_URL!,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY!,
    DATABASE_URL: env.DATABASE_URL!,
  };
}
