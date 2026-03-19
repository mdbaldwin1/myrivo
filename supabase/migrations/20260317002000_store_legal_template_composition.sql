alter table public.store_legal_documents
  add column if not exists addendum_markdown text not null default '',
  add column if not exists published_addendum_markdown text not null default '',
  add column if not exists published_base_document_version_id uuid references public.legal_document_versions(id) on delete set null,
  add column if not exists published_base_version_label text;

alter table public.store_legal_document_versions
  add column if not exists addendum_markdown text not null default '',
  add column if not exists base_document_version_id uuid references public.legal_document_versions(id) on delete set null,
  add column if not exists base_version_label text;

with latest_store_base_versions as (
  select distinct on (d.key)
    d.key,
    v.id,
    v.version_label
  from public.legal_documents d
  join public.legal_document_versions v on v.legal_document_id = d.id
  where d.key in ('store_privacy_base', 'store_terms_base')
    and v.status = 'published'
  order by d.key, v.published_at desc nulls last, v.created_at desc
)
update public.store_legal_documents d
set
  addendum_markdown = case
    when d.key = 'privacy' then coalesce(
      nullif(trim(coalesce(d.variables_json ->> 'privacyAdditionalDetails', '')), ''),
      case when d.source_mode = 'custom' then coalesce(nullif(trim(d.body_markdown), ''), '') else '' end,
      ''
    )
    else coalesce(
      nullif(trim(coalesce(d.variables_json ->> 'termsAdditionalDetails', '')), ''),
      case when d.source_mode = 'custom' then coalesce(nullif(trim(d.body_markdown), ''), '') else '' end,
      ''
    )
  end,
  published_addendum_markdown = case
    when d.key = 'privacy' then coalesce(
      nullif(trim(coalesce(d.published_variables_json ->> 'privacyAdditionalDetails', '')), ''),
      case when d.published_source_mode = 'custom' then coalesce(nullif(trim(d.published_body_markdown), ''), '') else '' end,
      ''
    )
    else coalesce(
      nullif(trim(coalesce(d.published_variables_json ->> 'termsAdditionalDetails', '')), ''),
      case when d.published_source_mode = 'custom' then coalesce(nullif(trim(d.published_body_markdown), ''), '') else '' end,
      ''
    )
  end,
  published_base_document_version_id = latest.id,
  published_base_version_label = latest.version_label
from latest_store_base_versions latest
where (
    (d.key = 'privacy' and latest.key = 'store_privacy_base')
    or (d.key = 'terms' and latest.key = 'store_terms_base')
  );

with latest_store_base_versions as (
  select distinct on (d.key)
    d.key,
    v.id,
    v.version_label
  from public.legal_documents d
  join public.legal_document_versions v on v.legal_document_id = d.id
  where d.key in ('store_privacy_base', 'store_terms_base')
    and v.status = 'published'
  order by d.key, v.published_at desc nulls last, v.created_at desc
)
update public.store_legal_document_versions v
set
  addendum_markdown = case
    when v.key = 'privacy' then coalesce(
      nullif(trim(coalesce(v.variables_json ->> 'privacyAdditionalDetails', '')), ''),
      case when v.source_mode = 'custom' then coalesce(nullif(trim(v.body_markdown), ''), '') else '' end,
      ''
    )
    else coalesce(
      nullif(trim(coalesce(v.variables_json ->> 'termsAdditionalDetails', '')), ''),
      case when v.source_mode = 'custom' then coalesce(nullif(trim(v.body_markdown), ''), '') else '' end,
      ''
    )
  end,
  base_document_version_id = latest.id,
  base_version_label = latest.version_label
from latest_store_base_versions latest
where (
    (v.key = 'privacy' and latest.key = 'store_privacy_base')
    or (v.key = 'terms' and latest.key = 'store_terms_base')
  );
