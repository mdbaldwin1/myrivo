alter table public.store_branding
  add column if not exists favicon_path text,
  add column if not exists apple_touch_icon_path text,
  add column if not exists og_image_path text,
  add column if not exists twitter_image_path text;
