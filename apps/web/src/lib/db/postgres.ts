import postgres, { type Sql } from "postgres";
import { getServerEnv } from "../env";

export type ServerDb = Sql;

export function createServerDb() {
  const env = getServerEnv({ requireSupabase: true });

  return postgres(env.DATABASE_URL, {
    max: 1,
  });
}

export async function closeServerDb(db: ServerDb) {
  await db.end();
}
