import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const protectedTables = [
  'profiles',
  'client_accounts',
  'client_memberships',
  'client_membership_facilities',
  'client_membership_engagements',
  'facilities',
  'engagements',
  'regulatory_cases',
  'deficiencies',
  'pocs',
  'evidence_items',
  'tasks',
  'work_products',
];

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

    const { rows: unprotectedTables } = await db.query(`
      select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and not c.relrowsecurity
      order by c.relname
    `);
    assert.deepEqual(
      unprotectedTables,
      [],
      'every public application table must have RLS enabled',
    );

    const { rows: protectedPolicyCoverage } = await db.query(`
      select c.relname as table_name,
             c.relrowsecurity as rls_enabled,
             count(p.polname)::int as policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_policy p on p.polrelid = c.oid
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname = any($1::text[])
      group by c.relname, c.relrowsecurity
      order by c.relname
    `, [protectedTables]);

    assert.equal(
      protectedPolicyCoverage.length,
      protectedTables.length,
      'every critical authorization table must be present after migration replay',
    );
    for (const row of protectedPolicyCoverage) {
      assert.equal(row.rls_enabled, true, `${row.table_name} must have RLS enabled`);
      assert.ok(
        Number(row.policy_count) > 0,
        `${row.table_name} must have at least one explicit RLS policy`,
      );
    }

    const { rows: broadPolicies } = await db.query(`
      select c.relname as table_name,
             p.polname as policy_name,
             coalesce(pg_get_expr(p.polqual, p.polrelid), '') as using_expression,
             coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as check_expression
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and (
          lower(btrim(coalesce(pg_get_expr(p.polqual, p.polrelid), ''))) in ('true', '(true)')
          or lower(btrim(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))) in ('true', '(true)')
          or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%auth.role()%'
          or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%auth.role()%'
        )
      order by c.relname, p.polname
    `);
    assert.deepEqual(
      broadPolicies,
      [],
      'RLS policies must not be trivially permissive or use deprecated auth.role()',
    );

    const { rows: profilePrivileges } = await db.query(`
      select
        has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') as can_update_name,
        has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') as can_update_role
    `);
    assert.equal(profilePrivileges[0]?.can_update_name, true);
    assert.equal(
      profilePrivileges[0]?.can_update_role,
      false,
      'authenticated users must never be able to update profiles.role directly',
    );

    await db.exec(readFileSync('tests/database-rpcs.sql', 'utf8'));
  } finally {
    await db.close();
  }
});
