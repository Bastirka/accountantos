-- AccountantOS: run in Supabase SQL Editor. Never run with an exposed secret.
create table if not exists public.workspaces(
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"companies":[],"current":"","transactions":[],"invoices":[]}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint workspace_payload_object check(jsonb_typeof(payload)='object'),
 constraint workspace_payload_size check(octet_length(payload::text)<=5000000)
);
alter table public.workspaces enable row level security;
drop policy if exists "workspace owner read" on public.workspaces;
drop policy if exists "workspace owner insert" on public.workspaces;
drop policy if exists "workspace owner update" on public.workspaces;
drop policy if exists "workspace owner delete" on public.workspaces;
create policy "workspace owner read" on public.workspaces for select to authenticated using ((select auth.uid())=user_id);
create policy "workspace owner insert" on public.workspaces for insert to authenticated with check ((select auth.uid())=user_id);
create policy "workspace owner update" on public.workspaces for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "workspace owner delete" on public.workspaces for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.workspaces to authenticated;
revoke all on public.workspaces from anon;

create table if not exists public.billing_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 stripe_customer_id text unique,
 stripe_subscription_id text unique,
 stripe_price_id text,
 plan text,
 status text not null default 'inactive',
 current_period_end timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
drop policy if exists "billing owner read" on public.billing_accounts;
create policy "billing owner read" on public.billing_accounts for select to authenticated using ((select auth.uid())=user_id);
grant select on public.billing_accounts to authenticated;
revoke all on public.billing_accounts from anon;
revoke insert,update,delete on public.billing_accounts from authenticated;