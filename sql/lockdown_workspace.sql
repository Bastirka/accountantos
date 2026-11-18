-- AccountantOS: apply after deploying /api/workspace.
-- Blocks direct browser writes; authorized reads and server-only service_role writes remain.
begin;
grant usage on schema public to service_role;
grant select,insert,update,delete on public.workspaces to service_role;
revoke insert,update,delete on public.workspaces from authenticated;
revoke all on public.workspaces from anon;
alter table public.workspaces enable row level security;
alter table public.billing_accounts enable row level security;
grant select,insert,update on public.billing_accounts to service_role;
revoke insert,update,delete on public.billing_accounts from authenticated;
commit;
