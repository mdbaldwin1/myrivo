alter table public.products
  add column if not exists sku text,
  add column if not exists image_url text,
  add column if not exists is_featured boolean not null default false;

create unique index if not exists idx_products_store_sku_unique
  on public.products(store_id, sku)
  where sku is not null;
