create table if not exists public.store_legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  store_legal_document_id uuid not null references public.store_legal_documents(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  key text not null check (key in ('privacy', 'terms')),
  version_number integer not null check (version_number >= 1),
  source_mode text not null check (source_mode in ('template', 'custom')),
  template_version text not null default 'v1',
  title text not null,
  body_markdown text not null default '',
  variables_json jsonb not null default '{}'::jsonb,
  change_summary text,
  effective_at timestamptz,
  published_at timestamptz not null default now(),
  published_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_legal_document_id, version_number)
);

create index if not exists idx_store_legal_document_versions_store
  on public.store_legal_document_versions(store_id, key, published_at desc);

alter table public.store_legal_document_versions enable row level security;

drop policy if exists store_legal_document_versions_public_read on public.store_legal_document_versions;
create policy store_legal_document_versions_public_read on public.store_legal_document_versions
for select
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_legal_document_versions.store_id
      and s.status = 'live'
  )
);

drop policy if exists store_legal_document_versions_owner_admin_manage on public.store_legal_document_versions;
create policy store_legal_document_versions_owner_admin_manage on public.store_legal_document_versions
for all
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_legal_document_versions.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_legal_document_versions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_legal_document_versions.store_id
      and s.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_legal_document_versions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);

insert into public.store_legal_document_versions (
  store_legal_document_id,
  store_id,
  key,
  version_number,
  source_mode,
  template_version,
  title,
  body_markdown,
  variables_json,
  change_summary,
  effective_at,
  published_at,
  published_by_user_id
)
select
  d.id,
  d.store_id,
  d.key,
  greatest(coalesce(d.published_version, 1), 1),
  coalesce(d.published_source_mode, d.source_mode),
  coalesce(nullif(d.published_template_version, ''), d.template_version, 'v1'),
  coalesce(nullif(trim(d.published_title), ''), nullif(trim(d.title_override), ''), case when d.key = 'privacy' then 'Privacy Policy' else 'Terms & Conditions' end),
  coalesce(nullif(trim(d.published_body_markdown), ''), d.body_markdown, ''),
  case
    when jsonb_typeof(d.published_variables_json) = 'object' then d.published_variables_json
    else coalesce(d.variables_json, '{}'::jsonb)
  end,
  d.published_change_summary,
  d.effective_at,
  coalesce(d.published_at, d.created_at, now()),
  d.published_by_user_id
from public.store_legal_documents d
where not exists (
  select 1
  from public.store_legal_document_versions v
  where v.store_legal_document_id = d.id
    and v.version_number = greatest(coalesce(d.published_version, 1), 1)
);
