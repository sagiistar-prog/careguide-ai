import postgres, { type Sql } from "postgres";
import { getScriptEnv } from "./script-env";

export type AdminClient = Sql;

export function createAdminClient() {
  const env = getScriptEnv();

  return postgres(env.DATABASE_URL, {
    max: 1,
  });
}

export async function closeAdminClient(db: AdminClient) {
  await db.end();
}

export function requireFirst<T>(rows: T[], label: string): T {
  if (rows.length === 0) {
    throw new Error(`${label}: no data returned`);
  }

  return rows[0];
}
