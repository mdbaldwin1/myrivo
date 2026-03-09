create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text,
  audience text not null default 'all' check (audience in ('all', 'merchant', 'customer', 'platform')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete cascade,
  version_label text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  is_required boolean not null default true,
  effective_at timestamptz,
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete set null,
  content_markdown text not null,
  content_hash text not null,
  change_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_document_id, version_label)
);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete restrict,
  legal_document_version_id uuid not null references public.legal_document_versions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  accepted_at timestamptz not null default now(),
  acceptance_surface text not null default 'signup' check (acceptance_surface in ('signup', 'login_gate', 'checkout', 'store_launch', 'account_settings', 'api')),
  ip_hash text,
  user_agent text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_legal_acceptances_user_version_store
  on public.legal_acceptances(user_id, legal_document_version_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_legal_document_versions_document_status
  on public.legal_document_versions(legal_document_id, status, effective_at desc);

create index if not exists idx_legal_acceptances_user_accepted_at
  on public.legal_acceptances(user_id, accepted_at desc);

create index if not exists idx_legal_acceptances_store_accepted_at
  on public.legal_acceptances(store_id, accepted_at desc);

drop trigger if exists legal_documents_set_updated_at on public.legal_documents;
create trigger legal_documents_set_updated_at
before update on public.legal_documents
for each row execute function public.set_updated_at();

drop trigger if exists legal_document_versions_set_updated_at on public.legal_document_versions;
create trigger legal_document_versions_set_updated_at
before update on public.legal_document_versions
for each row execute function public.set_updated_at();

create or replace function public.prevent_legal_acceptance_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'legal_acceptances rows are immutable once written';
end;
$$;

drop trigger if exists legal_acceptances_immutable_update on public.legal_acceptances;
create trigger legal_acceptances_immutable_update
before update on public.legal_acceptances
for each row execute function public.prevent_legal_acceptance_mutation();

drop trigger if exists legal_acceptances_immutable_delete on public.legal_acceptances;
create trigger legal_acceptances_immutable_delete
before delete on public.legal_acceptances
for each row execute function public.prevent_legal_acceptance_mutation();

alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;

drop policy if exists legal_documents_public_read on public.legal_documents;
create policy legal_documents_public_read on public.legal_documents
for select
using (is_active = true);

drop policy if exists legal_document_versions_public_read on public.legal_document_versions;
create policy legal_document_versions_public_read on public.legal_document_versions
for select
using (status = 'published');

drop policy if exists legal_documents_admin_manage on public.legal_documents;
create policy legal_documents_admin_manage on public.legal_documents
for all
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('admin', 'support')
  )
)
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('admin', 'support')
  )
);

drop policy if exists legal_document_versions_admin_manage on public.legal_document_versions;
create policy legal_document_versions_admin_manage on public.legal_document_versions
for all
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('admin', 'support')
  )
)
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('admin', 'support')
  )
);

drop policy if exists legal_acceptances_self_insert on public.legal_acceptances;
create policy legal_acceptances_self_insert on public.legal_acceptances
for insert
with check (user_id = auth.uid());

drop policy if exists legal_acceptances_self_read on public.legal_acceptances;
create policy legal_acceptances_self_read on public.legal_acceptances
for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('admin', 'support')
  )
);
