alter table public.store_settings
  add column if not exists footer_tagline text,
  add column if not exists footer_note text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists tiktok_url text;
