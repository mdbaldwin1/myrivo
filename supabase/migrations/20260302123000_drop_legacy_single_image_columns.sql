-- Remove deprecated single-image columns in favor of array-based image fields.

alter table public.products
  drop column if exists image_url;

alter table public.product_variants
  drop column if exists image_url,
  drop column if exists group_image_url;

alter table public.products
  alter column image_urls set default '{}'::text[],
  alter column image_urls set not null;

alter table public.product_variants
  alter column image_urls set default '{}'::text[],
  alter column image_urls set not null,
  alter column group_image_urls set default '{}'::text[],
  alter column group_image_urls set not null;
