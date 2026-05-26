import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { getScriptEnv } from "../ingest/lib/script-env";

type PgErrorLike = Error & {
  code?: string;
  detail?: string;
  hint?: string;
  schema_name?: string;
  table_name?: string;
  column_name?: string;
  constraint_name?: string;
  position?: string;
};

class MigrationStatementError extends Error {
  readonly original: unknown;
  readonly file: string;
  readonly statementIndex: number;
  readonly statementTotal: number;
  readonly statement: string;

  constructor(input: {
    original: unknown;
    file: string;
    statementIndex: number;
    statementTotal: number;
    statement: string;
  }) {
    super("Migration statement failed.");
    this.name = "MigrationStatementError";
    this.original = input.original;
    this.file = input.file;
    this.statementIndex = input.statementIndex;
    this.statementTotal = input.statementTotal;
    this.statement = input.statement;
  }
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;
  let dollarQuoteTag: string | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarQuoteTag) {
      current += char;
      if (sql.startsWith(dollarQuoteTag, index)) {
        current += dollarQuoteTag.slice(1);
        index += dollarQuoteTag.length - 1;
        dollarQuoteTag = null;
      }
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "-" && next === "-") {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "/" && next === "*") {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarQuoteTag = match[0];
        current += dollarQuoteTag;
        index += dollarQuoteTag.length - 1;
        continue;
      }
    }

    if (!doubleQuoted && char === "'" && sql[index - 1] !== "\\") {
      singleQuoted = !singleQuoted;
      current += char;
      continue;
    }

    if (!singleQuoted && char === '"') {
      doubleQuoted = !doubleQuoted;
      current += char;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === ";") {
      const statement = current.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
}

function redactSensitiveText(input: string) {
  return input
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/https?:\/\/\S*(?:api[_-]?key|token|password|secret)\S*/gi, "[redacted-url]")
    .replace(
      /\b(api[_-]?key|password|passwd|pwd|secret|token|subscription[_-]?key)\b\s*[:=]\s*('[^']*'|"[^"]*"|[^\s,)]+)/gi,
      "$1=[redacted]",
    )
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted-long-token]");
}

function summarizeStatement(statement: string) {
  return redactSensitiveText(statement.replace(/\s+/g, " ").trim()).slice(0, 150);
}

function pgField(error: unknown, key: keyof PgErrorLike) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const value = (error as PgErrorLike)[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function migrationSuggestion(code: string | undefined, message: string | undefined) {
  const text = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (text.includes("type") && text.includes("vector")) {
    return "Suggestion: enable the vector extension in Supabase Dashboard, then rerun migration.";
  }

  if (code === "42501" || text.includes("permission denied")) {
    return "Suggestion: run the migration with a database role that can create extensions, tables, and indexes, or enable required extensions in Supabase Dashboard first.";
  }

  if (code === "42601" || text.includes("syntax error")) {
    return "Suggestion: inspect the failed statement syntax near the reported position.";
  }

  if (code === "42P07" || text.includes("relation") && text.includes("already exists")) {
    return "Suggestion: make the statement idempotent with IF NOT EXISTS or a DO block guard.";
  }

  if (code === "42710" || text.includes("already exists")) {
    return "Suggestion: duplicate object detected. Use IF NOT EXISTS or treat extension/schema creation as a non-fatal notice.";
  }

  if (code === "42704" || text.includes("does not exist")) {
    return "Suggestion: check object creation order and required extensions.";
  }

  return "Suggestion: inspect the failed statement and database permissions.";
}

function isNonFatalAlreadyExists(error: unknown, statement: string) {
  const code = pgField(error, "code");
  const lowered = statement.toLowerCase();

  return (
    (code === "42710" || code === "42P06") &&
    (lowered.includes("create extension") || lowered.includes("create schema"))
  );
}

function printStatementError(error: MigrationStatementError) {
  const original = error.original;
  const code = pgField(original, "code");
  const message =
    pgField(original, "message") ||
    (original instanceof Error ? original.message : "Unknown PostgreSQL error.");
  const detail = pgField(original, "detail");
  const hint = pgField(original, "hint");
  const schema = pgField(original, "schema_name");
  const table = pgField(original, "table_name");
  const column = pgField(original, "column_name");
  const constraint = pgField(original, "constraint_name");
  const position = pgField(original, "position");

  console.error("Migration failed with safe PostgreSQL diagnostics:");
  console.error(`file: ${error.file}`);
  console.error(
    `statement: ${error.statementIndex} of ${error.statementTotal}`,
  );
  console.error(`code: ${code ?? "unknown"}`);
  console.error(`message: ${redactSensitiveText(message)}`);
  console.error(`detail: ${detail ? redactSensitiveText(detail) : "none"}`);
  console.error(`hint: ${hint ? redactSensitiveText(hint) : "none"}`);
  console.error(`schema: ${schema ?? "none"}`);
  console.error(`table: ${table ?? "none"}`);
  console.error(`column: ${column ?? "none"}`);
  console.error(`constraint: ${constraint ?? "none"}`);
  console.error(`position: ${position ?? "none"}`);
  console.error(`sql_summary: ${summarizeStatement(error.statement)}`);
  console.error(migrationSuggestion(code, message));
}

function printConnectionOrSetupError(error: unknown) {
  const code = pgField(error, "code");
  const message =
    pgField(error, "message") ||
    (error instanceof Error ? error.message : "Unknown database error.");

  console.error("Migration setup failed with safe diagnostics:");
  console.error(`code: ${code ?? "unknown"}`);
  console.error(`message: ${redactSensitiveText(message)}`);
  console.error(migrationSuggestion(code, message));
}

async function main() {
  const env = getScriptEnv();
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
    onnotice: (notice) => {
      const message = redactSensitiveText(notice.message ?? "PostgreSQL notice");
      console.warn(`PostgreSQL notice: ${message}`);
    },
  });

  try {
    await sql`
      create table if not exists public.careguide_schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      const existing = await sql`
        select version
        from public.careguide_schema_migrations
        where version = ${file}
      `;

      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      const migrationSql = (
        await readFile(path.join(migrationsDir, file), "utf8")
      ).replaceAll(
        "__GEMINI_EMBEDDING_DIMENSION__",
        String(env.GEMINI_EMBEDDING_DIMENSION),
      );
      const statements = splitSqlStatements(migrationSql);

      await sql.begin(async (tx) => {
        for (const [index, statement] of statements.entries()) {
          const statementIndex = index + 1;
          console.log(
            `Running migration statement ${statementIndex} of ${statements.length}: ${summarizeStatement(statement)}`,
          );

          try {
            await tx.unsafe(statement);
          } catch (error) {
            if (isNonFatalAlreadyExists(error, statement)) {
              console.warn(
                `Non-fatal already-exists notice at statement ${statementIndex}; continuing.`,
              );
              continue;
            }

            throw new MigrationStatementError({
              original: error,
              file,
              statementIndex,
              statementTotal: statements.length,
              statement,
            });
          }
        }

        await tx`
          insert into public.careguide_schema_migrations (version)
          values (${file})
        `;
      });

      applied += 1;
    }

    console.log(`Migrations complete. applied=${applied} skipped=${skipped}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  if (error instanceof MigrationStatementError) {
    printStatementError(error);
  } else {
    printConnectionOrSetupError(error);
  }

  process.exit(1);
});
