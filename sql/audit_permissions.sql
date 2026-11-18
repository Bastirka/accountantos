-- Read-only AccountantOS authorization audit.
-- Execute in Supabase SQL Editor. Every row must satisfy expected_ok = true.
-- Does not change or reveal financial records.
with checks as (
  select 'workspaces RLS enabled' as check_name,
    (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='workspaces') as expected_ok
  union all select 'billing_accounts RLS enabled',
    (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='billing_accounts')
  union all select 'authenticated cannot INSERT workspaces',
    not has_table_privilege('authenticated','public.workspaces','INSERT')
  union all select 'authenticated cannot UPDATE workspaces',
    not has_table_privilege('authenticated','public.workspaces','UPDATE')
  union all select 'authenticated cannot DELETE workspaces',
    not has_table_privilege('authenticated','public.workspaces','DELETE')
  union all select 'anon cannot SELECT workspaces',
    not has_table_privilege('anon','public.workspaces','SELECT')
  union all select 'authenticated cannot modify billing',
    not (
      has_table_privilege('authenticated','public.billing_accounts','INSERT')
      or has_table_privilege('authenticated','public.billing_accounts','UPDATE')
      or has_table_privilege('authenticated','public.billing_accounts','DELETE')
    )
  union all select 'service_role can read workspaces',
    has_table_privilege('service_role','public.workspaces','SELECT')
  union all select 'service_role can modify workspaces',
    has_table_privilege('service_role','public.workspaces','INSERT')
    and has_table_privilege('service_role','public.workspaces','UPDATE')
  union all select 'service_role can modify billing',
    has_table_privilege('service_role','public.billing_accounts','INSERT')
    and has_table_privilege('service_role','public.billing_accounts','UPDATE')
)
select check_name, expected_ok from checks order by check_name;

-- Inspect all live policies (particularly unexpected broad policies).
select tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in ('workspaces','billing_accounts')
order by tablename,policyname;
