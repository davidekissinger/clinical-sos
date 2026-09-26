-- ClinicalSOS Supabase authorization/RLS audit
-- Read-only verification queries for the live project.
-- These statements should not mutate schema or data.

-- 1. RLS-enabled tables without any policy.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (
    select 1 from pg_policy p where p.polrelid = c.oid
  )
order by c.relname;

-- 2. Policies that deserve immediate manual review because they are trivially broad
-- or use the deprecated auth.role() helper.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(trim(qual), '') in ('true', '(true)')
    or coalesce(trim(with_check), '') in ('true', '(true)')
    or qual ilike '%auth.role()%'
    or with_check ilike '%auth.role()%'
  )
order by tablename, policyname;

-- 3. Browser-role table grants. RLS must be evaluated together with these grants.
select table_name,
       grantee,
       string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 4. SECURITY DEFINER functions and whether browser/public roles can execute them.
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

-- 5. Policies on the highest-risk tenancy and clinical tables.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'client_accounts',
    'client_memberships',
    'client_membership_facilities',
    'client_membership_engagements',
    'engagements',
    'facilities',
    'regulatory_cases',
    'deficiencies',
    'pocs',
    'evidence_items',
    'tasks',
    'work_products',
    'user_identity_profiles',
    'user_name_change_requests',
    'user_identity_audit_events',
    'subscription_tiers',
    'automation_logs'
  )
order by tablename, policyname;

-- 6. Public functions and browser execution rights.
select n.nspname as schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, args;
