alter table public.products
  add column if not exists slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists image_alt_text text;

alter table public.store_settings
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_noindex boolean not null default false;

update public.products
set slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(title, ''), '[''"]', '', 'g'),
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    ),
    '(^-+|-+$)',
    '',
    'g'
  )
) || '-' || left(id::text, 8)
where coalesce(trim(slug), '') = '';

create unique index if not exists idx_products_store_slug_unique
  on public.products (store_id, lower(slug))
  where slug is not null and length(trim(slug)) > 0;
