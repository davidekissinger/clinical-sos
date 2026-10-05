-- ClinicalSOS authorization / RLS verification
-- Read-only audit for Phase 3 (issue #5).
-- Safe to run against the connected Supabase project; no statement mutates data or schema.

-- 1. Confirm every public table has RLS and identify tables with no policies.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       count(p.polname)::int as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;

-- 2. Flag trivially permissive policies and deprecated auth.role() usage.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(trim(qual), '') in ('true', '(true)')
    or coalesce(trim(with_check), '') in ('true', '(true)')
    or coalesce(qual, '') ilike '%auth.role()%'
    or coalesce(with_check, '') ilike '%auth.role()%'
  )
order by tablename, policyname;

-- 3. Inspect the critical authorization / tenant / clinical policy surface.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
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
    'work_products'
  )
order by tablename, policyname;

-- 4. Browser-role table grants. These must be reviewed together with RLS.
select table_name,
       grantee,
       string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 5. Verify profile authorization data cannot be updated from the browser.
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type, column_name;

-- 6. SECURITY DEFINER functions must not be directly executable by browser/public roles
-- unless explicitly reviewed as a public API boundary.
select n.nspname as schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prosecdef
order by n.nspname, p.proname, args;
