#!/usr/bin/env node
// Applies any supabase/migrations/*.sql files not yet recorded as run,
// via the Supabase Management API (no DB password needed/available for this
// project — see docs/SETUP.md). Tracks applied versions in the same
// supabase_migrations.schema_migrations table the Supabase CLI itself uses
// (`supabase db push`), so the two stay compatible if a DB password is ever
// obtained later.
//
// Usage:
//   node scripts/apply-migrations.mjs          # apply all pending migrations
//   node scripts/apply-migrations.mjs --check  # list pending migrations, apply nothing
//
// Required env vars: SUPABASE_URL, SUPABASE_ACCESS_TOKEN (a Supabase
// personal access token — NOT the service-role key, which can't call the
// Management API).

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const CHECK_ONLY = process.argv.includes('--check');

const SUPABASE_URL = process.env['SUPABASE_URL'];
const ACCESS_TOKEN = process.env['SUPABASE_ACCESS_TOKEN'];

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('Missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN env var.');
  process.exit(1);
}

const projectRefMatch = SUPABASE_URL.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
if (!projectRefMatch) {
  console.error(`Could not derive project ref from SUPABASE_URL: ${SUPABASE_URL}`);
  process.exit(1);
}
const PROJECT_REF = projectRefMatch[1];
const QUERY_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runQuery(sql) {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API error (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : [];
}

function parseMigrationFile(filename) {
  const match = filename.match(/^(\d+)_(.+)\.sql$/);
  if (!match) return null;
  return { version: match[1], name: match[2], filename };
}

async function main() {
  await runQuery(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version    text primary key,
      statements text[],
      name       text
    );
  `);

  const applied = await runQuery('select version from supabase_migrations.schema_migrations;');
  const appliedVersions = new Set(applied.map((r) => r.version));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files
    .map(parseMigrationFile)
    .filter((m) => m && !appliedVersions.has(m.version));

  if (pending.length === 0) {
    console.log(`Up to date — ${files.length} migrations, none pending.`);
    return;
  }

  console.log(`${pending.length} pending migration(s):`);
  for (const m of pending) console.log(`  ${m.filename}`);

  if (CHECK_ONLY) return;

  for (const m of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, m.filename), 'utf-8');
    console.log(`Applying ${m.filename} ...`);
    try {
      await runQuery(sql);
    } catch (err) {
      console.error(`FAILED applying ${m.filename}:`);
      console.error(err instanceof Error ? err.message : err);
      console.error('Stopping — later migrations were not attempted.');
      process.exit(1);
    }
    // Record the whole file as one statement — this script always applies
    // files as a single Management API query (proven safe for multi-
    // statement files, including $$...$$ plpgsql bodies containing their
    // own semicolons), so a naive per-statement split isn't needed here.
    const escapedSql = sql.replace(/'/g, "''");
    const escapedName = m.name.replace(/'/g, "''");
    await runQuery(
      `insert into supabase_migrations.schema_migrations (version, name, statements) ` +
      `values ('${m.version}', '${escapedName}', array['${escapedSql}']) ` +
      `on conflict (version) do nothing;`
    );
    console.log(`  done.`);
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
