alter table public.store_legal_documents
  add column if not exists published_source_mode text not null default 'template' check (published_source_mode in ('template', 'custom')),
  add column if not exists published_template_version text not null default 'v1',
  add column if not exists published_title text,
  add column if not exists published_body_markdown text not null default '',
  add column if not exists published_variables_json jsonb not null default '{}'::jsonb,
  add column if not exists published_version integer not null default 1 check (published_version >= 1),
  add column if not exists published_change_summary text,
  add column if not exists effective_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists published_by_user_id uuid references auth.users(id) on delete set null;

update public.store_legal_documents
set
  published_source_mode = coalesce(nullif(published_source_mode, ''), source_mode),
  published_template_version = coalesce(nullif(published_template_version, ''), template_version),
  published_title = coalesce(published_title, title_override),
  published_body_markdown = case
    when coalesce(trim(published_body_markdown), '') <> '' then published_body_markdown
    else body_markdown
  end,
  published_variables_json = case
    when jsonb_typeof(published_variables_json) = 'object' and published_variables_json <> '{}'::jsonb then published_variables_json
    else variables_json
  end,
  published_version = greatest(coalesce(published_version, 1), 1),
  effective_at = coalesce(effective_at, created_at, now()),
  published_at = coalesce(published_at, created_at, now());
