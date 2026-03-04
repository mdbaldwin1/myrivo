alter table public.products
  add column if not exists image_urls text[] not null default '{}'::text[];

update public.products
set image_urls = case
  when image_url is null then '{}'::text[]
  else array[image_url]
end
where image_urls is null or array_length(image_urls, 1) is null;

alter table public.product_variants
  add column if not exists image_urls text[] not null default '{}'::text[],
  add column if not exists group_image_urls text[] not null default '{}'::text[];

update public.product_variants
set image_urls = case
  when image_url is null then '{}'::text[]
  else array[image_url]
end
where image_urls is null or array_length(image_urls, 1) is null;

update public.product_variants
set group_image_urls = case
  when group_image_url is null then '{}'::text[]
  else array[group_image_url]
end
where group_image_urls is null or array_length(group_image_urls, 1) is null;
