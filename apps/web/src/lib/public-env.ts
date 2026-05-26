export type PublicEnv = Readonly<{
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}>;

type PublicEnvOptions = {
  requireSupabase?: boolean;
};

function isMissing(value: string | undefined) {
  return value == null || value.trim() === "" || /^your_/i.test(value.trim());
}

export function getPublicEnv(options: PublicEnvOptions = {}): PublicEnv {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  if (
    options.requireSupabase &&
    (isMissing(env.NEXT_PUBLIC_SUPABASE_URL) ||
      isMissing(env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  ) {
    throw new Error(
      "Missing public Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local. Values are intentionally not printed.",
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}
