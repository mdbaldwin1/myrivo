alter table public.product_variants
  add column if not exists image_url text,
  add column if not exists group_image_url text;
