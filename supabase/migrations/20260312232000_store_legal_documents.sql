create table if not exists public.store_legal_documents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  key text not null check (key in ('privacy', 'terms')),
  source_mode text not null default 'template' check (source_mode in ('template', 'custom')),
  template_version text not null default 'v1',
  title_override text,
  body_markdown text not null default '',
  variables_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, key)
);

create index if not exists idx_store_legal_documents_store
  on public.store_legal_documents(store_id);

drop trigger if exists store_legal_documents_set_updated_at on public.store_legal_documents;
create trigger store_legal_documents_set_updated_at
before update on public.store_legal_documents
for each row execute function public.set_updated_at();

alter table public.store_legal_documents enable row level security;

drop policy if exists store_legal_documents_public_read on public.store_legal_documents;
create policy store_legal_documents_public_read on public.store_legal_documents
for select
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_legal_documents.store_id
      and s.status = 'active'
  )
);

drop policy if exists store_legal_documents_owner_admin_manage on public.store_legal_documents;
create policy store_legal_documents_owner_admin_manage on public.store_legal_documents
for all
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_legal_documents.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_legal_documents.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_legal_documents.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_legal_documents.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);

insert into public.store_legal_documents (store_id, key)
select s.id, document_key.key
from public.stores s
cross join (values ('privacy'::text), ('terms'::text)) as document_key(key)
on conflict (store_id, key) do nothing;
