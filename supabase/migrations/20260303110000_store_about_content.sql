alter table public.store_settings
  add column if not exists about_article_html text,
  add column if not exists about_sections jsonb not null default '[]'::jsonb;
