import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import { pool } from "./db";
import * as schema from "@shared/schema";

export interface SchemaDriftIssue {
  kind: "missing_table" | "missing_column";
  table: string;
  column?: string;
}

export interface SchemaDriftResult {
  inSync: boolean;
  issues: SchemaDriftIssue[];
}

interface ExpectedTable {
  schema: string;
  name: string;
  columns: Set<string>;
}

function collectExpectedTables(): ExpectedTable[] {
  const tables: ExpectedTable[] = [];
  for (const value of Object.values(schema)) {
    if (!value || !is(value as object, PgTable)) continue;
    const cfg = getTableConfig(value as PgTable);
    tables.push({
      schema: cfg.schema ?? "public",
      name: cfg.name,
      columns: new Set(cfg.columns.map((c) => c.name)),
    });
  }
  return tables;
}

export async function checkSchemaDrift(): Promise<SchemaDriftResult> {
  const expected = collectExpectedTables();
  const schemaNames = Array.from(new Set(expected.map((t) => t.schema)));

  const { rows } = await pool.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
  }>(
    `SELECT table_schema, table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = ANY($1::text[])`,
    [schemaNames],
  );

  const actual = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    let cols = actual.get(key);
    if (!cols) {
      cols = new Set();
      actual.set(key, cols);
    }
    cols.add(row.column_name);
  }

  const issues: SchemaDriftIssue[] = [];
  for (const t of expected) {
    const key = `${t.schema}.${t.name}`;
    const actualCols = actual.get(key);
    if (!actualCols) {
      issues.push({ kind: "missing_table", table: key });
      continue;
    }
    for (const col of t.columns) {
      if (!actualCols.has(col)) {
        issues.push({ kind: "missing_column", table: key, column: col });
      }
    }
  }

  return { inSync: issues.length === 0, issues };
}

export async function assertSchemaInSync(): Promise<void> {
  let result: SchemaDriftResult;
  try {
    result = await checkSchemaDrift();
  } catch (err) {
    const banner = "=".repeat(72);
    console.error(`\n${banner}`);
    console.error("SCHEMA DRIFT CHECK FAILED TO RUN");
    console.error(banner);
    console.error(
      "Could not compare the Drizzle schema with the live database:",
    );
    console.error(err);
    console.error(
      "\nRefusing to start the server because the guardrail cannot be verified.",
    );
    console.error(
      "Fix the underlying error, or set SKIP_SCHEMA_CHECK=1 to bypass.",
    );
    console.error(`${banner}\n`);
    process.exit(1);
  }

  if (result.inSync) {
    console.log("[schema-check] Drizzle schema and database are in sync");
    return;
  }

  const banner = "=".repeat(72);
  console.error(`\n${banner}`);
  console.error("DATABASE SCHEMA DRIFT DETECTED");
  console.error(banner);
  console.error(
    "The Drizzle schema in shared/schema.ts does not match the live database.",
  );
  console.error(`Found ${result.issues.length} issue(s):`);
  for (const issue of result.issues) {
    if (issue.kind === "missing_table") {
      console.error(`  - missing table: ${issue.table}`);
    } else {
      console.error(`  - missing column: ${issue.table}.${issue.column}`);
    }
  }
  console.error(
    "\nRun `npm run db:push` to apply pending schema changes, then restart the server.",
  );
  console.error(
    "To bypass this check temporarily, set SKIP_SCHEMA_CHECK=1.",
  );
  console.error(`${banner}\n`);

  process.exit(1);
}
