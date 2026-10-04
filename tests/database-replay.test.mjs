import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('applied migration history replays and protects integration RPCs', async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase-owned objects; all application tables/functions are real migrations.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,created_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function public.rls_auto_enable() returns void language sql as $$ select $$;`);
    for (const filename of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(`supabase/migrations/${filename}`, 'utf8'));
    }
    await db.exec(readFileSync('tests/database-rpcs.sql', 'utf8'));
  } finally {
    await db.close();
  }
});
