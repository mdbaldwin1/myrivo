alter table public.store_pickup_settings
  add column if not exists geolocation_fallback_mode text not null default 'allow_without_distance'
    check (geolocation_fallback_mode in ('allow_without_distance', 'disable_pickup')),
  add column if not exists out_of_radius_behavior text not null default 'disable_pickup'
    check (out_of_radius_behavior in ('disable_pickup', 'allow_all_locations'));

