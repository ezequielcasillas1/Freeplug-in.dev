import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * Applies every file in supabase/migrations to an in-memory Postgres (PGlite) with a minimal
 * Supabase shim (auth schema, anon / authenticated / service_role roles, auth.uid(), auth.role()).
 * Test-only: no network, no hosted or preview database.
 */
export async function migratedDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin;
    create schema auth; create schema extensions; create schema storage;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    grant select on auth.users to service_role;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
  `)
  const dir = path.resolve(__dirname, '../supabase/migrations')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(path.join(dir, f), 'utf8'))
    } catch (e) {
      throw new Error(`${f}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return db
}

/** Runs one statement as a given role / user (like a PostgREST request). */
export async function asRole(db: PGlite, role: 'authenticated' | 'service_role' | 'anon', uid: string | null, sql: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claim.role', '${role}', false); set role ${role};`
  )
  try {
    const r = await db.query<Record<string, unknown>>(sql)
    return { ok: true as const, rows: r.rows, count: r.affectedRows ?? 0 }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e), rows: [], count: 0 }
  } finally {
    await db.exec('reset role')
  }
}
