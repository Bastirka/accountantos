-- AccountantOS normalized storage v1
-- Non-destructive: creates new tables and copies data from public.workspaces.
-- The legacy workspaces row remains untouched and is still the application's source of truth.
begin;

create table if not exists public.schema_migrations (
 name text primary key,
 applied_at timestamptz not null default now(),
 details jsonb not null default '{}'::jsonb
);

create table if not exists public.companies (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 name text not null check (char_length(name) between 1 and 180),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id)
);

create table if not exists public.transactions (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 company_id text not null,
 transaction_date text not null check (char_length(transaction_date)<=20),
 description text not null check (char_length(description)<=500),
 amount numeric(18,2) not null,
 reference text not null default '' check (char_length(reference)<=220),
 review_status text check (review_status is null or char_length(review_status)<=30),
 source_document_id text,
 source_document_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id),
 foreign key (user_id,company_id) references public.companies(user_id,id) on delete cascade
);

create table if not exists public.invoices (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 company_id text not null,
 number text not null check (char_length(number)<=120),
 partner text not null check (char_length(partner)<=220),
 total numeric(18,2) not null,
 invoice_date text not null check (char_length(invoice_date)<=20),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id),
 foreign key (user_id,company_id) references public.companies(user_id,id) on delete cascade
);

create table if not exists public.documents (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 company_id text not null,
 name text not null check (char_length(name)<=220),
 mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
 size_bytes bigint not null check (size_bytes between 1 and 10485760),
 storage_path text not null check (char_length(storage_path)<=500),
 status text not null default 'review',
 added_label text,
 ocr_text text,
 extracted jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted)='object'),
 created_transaction_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id),
 unique (user_id,storage_path),
 foreign key (user_id,company_id) references public.companies(user_id,id) on delete cascade
);

create index if not exists transactions_user_company_date_idx
 on public.transactions(user_id,company_id,transaction_date desc,id);
create index if not exists transactions_user_reference_idx
 on public.transactions(user_id,company_id,reference);
create index if not exists invoices_user_company_date_idx
 on public.invoices(user_id,company_id,invoice_date desc,id);
create index if not exists invoices_user_number_idx
 on public.invoices(user_id,company_id,number);
create index if not exists documents_user_company_created_idx
 on public.documents(user_id,company_id,created_at desc,id);

alter table public.companies enable row level security;
alter table public.transactions enable row level security;
alter table public.invoices enable row level security;
alter table public.documents enable row level security;
alter table public.schema_migrations enable row level security;

drop policy if exists "companies owner read" on public.companies;
drop policy if exists "transactions owner read" on public.transactions;
drop policy if exists "invoices owner read" on public.invoices;
drop policy if exists "documents owner read" on public.documents;
create policy "companies owner read" on public.companies for select to authenticated using ((select auth.uid())=user_id);
create policy "transactions owner read" on public.transactions for select to authenticated using ((select auth.uid())=user_id);
create policy "invoices owner read" on public.invoices for select to authenticated using ((select auth.uid())=user_id);
create policy "documents owner read" on public.documents for select to authenticated using ((select auth.uid())=user_id);

grant usage on schema public to authenticated,service_role;
grant select on public.companies,public.transactions,public.invoices,public.documents to authenticated;
revoke insert,update,delete on public.companies,public.transactions,public.invoices,public.documents from authenticated;
revoke all on public.companies,public.transactions,public.invoices,public.documents,public.schema_migrations from anon;
grant select,insert,update,delete on public.companies,public.transactions,public.invoices,public.documents,public.schema_migrations to service_role;

insert into public.companies(user_id,id,name)
select w.user_id,c->>'id',c->>'name'
from public.workspaces w
cross join lateral jsonb_array_elements(coalesce(w.payload->'companies','[]'::jsonb)) c
where nullif(c->>'id','') is not null and nullif(c->>'name','') is not null
on conflict (user_id,id) do update set name=excluded.name,updated_at=now();

insert into public.transactions(
 user_id,id,company_id,transaction_date,description,amount,reference,review_status,
 source_document_id,source_document_name
)
select w.user_id,t->>'id',t->>'company',t->>'date',t->>'description',
 (t->>'amount')::numeric,coalesce(t->>'reference',''),t->>'reviewStatus',
 t->>'sourceDocumentId',t->>'sourceDocumentName'
from public.workspaces w
cross join lateral jsonb_array_elements(coalesce(w.payload->'transactions','[]'::jsonb)) t
where nullif(t->>'id','') is not null
 and nullif(t->>'company','') is not null
 and nullif(t->>'date','') is not null
 and nullif(t->>'description','') is not null
 and (t->>'amount') ~ '^-?[0-9]+([.][0-9]+)?$'
on conflict (user_id,id) do update set
 company_id=excluded.company_id,transaction_date=excluded.transaction_date,
 description=excluded.description,amount=excluded.amount,reference=excluded.reference,
 review_status=excluded.review_status,source_document_id=excluded.source_document_id,
 source_document_name=excluded.source_document_name,updated_at=now();

insert into public.invoices(user_id,id,company_id,number,partner,total,invoice_date)
select w.user_id,i->>'id',i->>'company',i->>'number',i->>'partner',
 (i->>'total')::numeric,i->>'date'
from public.workspaces w
cross join lateral jsonb_array_elements(coalesce(w.payload->'invoices','[]'::jsonb)) i
where nullif(i->>'id','') is not null
 and nullif(i->>'company','') is not null
 and nullif(i->>'number','') is not null
 and nullif(i->>'partner','') is not null
 and nullif(i->>'date','') is not null
 and (i->>'total') ~ '^-?[0-9]+([.][0-9]+)?$'
on conflict (user_id,id) do update set
 company_id=excluded.company_id,number=excluded.number,partner=excluded.partner,
 total=excluded.total,invoice_date=excluded.invoice_date,updated_at=now();

insert into public.documents(
 user_id,id,company_id,name,mime_type,size_bytes,storage_path,status,added_label,
 ocr_text,extracted,created_transaction_id
)
select w.user_id,d->>'id',d->>'company',d->>'name',d->>'type',
 (d->>'size')::bigint,d->>'storagePath',coalesce(d->>'status','review'),d->>'added',
 d->>'ocrText',coalesce(d->'extracted','{}'::jsonb),d->>'createdTransactionId'
from public.workspaces w
cross join lateral jsonb_array_elements(coalesce(w.payload->'documents','[]'::jsonb)) d
where nullif(d->>'id','') is not null
 and nullif(d->>'company','') is not null
 and nullif(d->>'name','') is not null
 and d->>'type' in ('image/jpeg','image/png','application/pdf')
 and (d->>'size') ~ '^[0-9]+$'
 and nullif(d->>'storagePath','') is not null
on conflict (user_id,id) do update set
 company_id=excluded.company_id,name=excluded.name,mime_type=excluded.mime_type,
 size_bytes=excluded.size_bytes,storage_path=excluded.storage_path,status=excluded.status,
 added_label=excluded.added_label,ocr_text=excluded.ocr_text,extracted=excluded.extracted,
 created_transaction_id=excluded.created_transaction_id,updated_at=now();

do $$
declare expected bigint; actual bigint;
begin
 select coalesce(sum(jsonb_array_length(coalesce(payload->'companies','[]'::jsonb))),0) into expected from public.workspaces;
 select count(*) into actual from public.companies;
 if actual < expected then raise exception 'Company backfill incomplete: expected at least %, copied %',expected,actual; end if;

 select coalesce(sum(jsonb_array_length(coalesce(payload->'transactions','[]'::jsonb))),0) into expected from public.workspaces;
 select count(*) into actual from public.transactions;
 if actual < expected then raise exception 'Transaction backfill incomplete: expected at least %, copied %',expected,actual; end if;

 select coalesce(sum(jsonb_array_length(coalesce(payload->'invoices','[]'::jsonb))),0) into expected from public.workspaces;
 select count(*) into actual from public.invoices;
 if actual < expected then raise exception 'Invoice backfill incomplete: expected at least %, copied %',expected,actual; end if;

 select coalesce(sum(jsonb_array_length(coalesce(payload->'documents','[]'::jsonb))),0) into expected from public.workspaces;
 select count(*) into actual from public.documents;
 if actual < expected then raise exception 'Document backfill incomplete: expected at least %, copied %',expected,actual; end if;
end $$;

insert into public.schema_migrations(name,details)
values ('normalized_storage_v1',jsonb_build_object(
 'source','public.workspaces',
 'legacy_preserved',true,
 'companies',(select count(*) from public.companies),
 'transactions',(select count(*) from public.transactions),
 'invoices',(select count(*) from public.invoices),
 'documents',(select count(*) from public.documents)
))
on conflict (name) do update set applied_at=now(),details=excluded.details;

commit;

-- Read-only verification after commit:
-- select * from public.schema_migrations where name='normalized_storage_v1';
-- select count(*) from public.companies;
-- select count(*) from public.transactions;
-- select count(*) from public.invoices;
-- select count(*) from public.documents;
