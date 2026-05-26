"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "../public-env";

export function createSupabaseBrowserClient() {
  const env = getPublicEnv({ requireSupabase: true });

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
