import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

type GlobalDb = {
  pool?: pg.Pool;
  local?: Promise<PGlite>;
};

const g = globalThis as typeof globalThis & { __distiplineDb?: GlobalDb };
g.__distiplineDb ??= {};

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const url = databaseUrl();
  if (url !== "") {
    g.__distiplineDb!.pool ??= new pg.Pool({ connectionString: url, max: 5 });
    return (await g.__distiplineDb!.pool.query(text, params)).rows as T[];
  }
  g.__distiplineDb!.local ??= startLocal().catch((error: unknown) => {
    g.__distiplineDb!.local = undefined;
    throw error;
  });
  return (await (await g.__distiplineDb!.local).query<T>(text, params)).rows;
}

async function migrationFiles() {
  return (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function startLocal(): Promise<PGlite> {
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );
  for (const file of await migrationFiles()) {
    if (done.has(file)) continue;
    const body = await readFile(`migrations/${file}`, "utf8");
    await db.exec(body);
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}
