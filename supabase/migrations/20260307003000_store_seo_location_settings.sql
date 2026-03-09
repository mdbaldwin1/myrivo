alter table public.store_settings
  add column if not exists seo_location_city text,
  add column if not exists seo_location_region text,
  add column if not exists seo_location_state text,
  add column if not exists seo_location_postal_code text,
  add column if not exists seo_location_country_code text,
  add column if not exists seo_location_address_line1 text,
  add column if not exists seo_location_address_line2 text,
  add column if not exists seo_location_show_full_address boolean not null default false;
