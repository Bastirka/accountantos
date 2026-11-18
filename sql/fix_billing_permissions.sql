-- AccountantOS: repair billing API permissions.
-- Run once in Supabase Dashboard > SQL Editor, as project owner.
-- Does NOT give browser users permission to modify subscriptions.
begin;
grant usage on schema public to authenticated, service_role;
grant select on table public.billing_accounts to authenticated;
grant select, insert, update on table public.billing_accounts to service_role;
revoke all on table public.billing_accounts from anon;
revoke insert, update, delete on table public.billing_accounts from authenticated;
alter table public.billing_accounts enable row level security;
drop policy if exists "billing owner read" on public.billing_accounts;
create policy "billing owner read"
  on public.billing_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
commit;

-- Inspect privileges after running:
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name='billing_accounts'
  and grantee in ('authenticated','service_role','anon')
order by grantee, privilege_type;
