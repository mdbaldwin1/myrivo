alter table public.promotions
  add column if not exists is_stackable boolean not null default false;

alter table public.store_settings
  add column if not exists checkout_max_promo_codes integer not null default 1
  check (checkout_max_promo_codes >= 1 and checkout_max_promo_codes <= 10);

alter table public.storefront_checkout_sessions
  add column if not exists promo_codes_json jsonb not null default '[]'::jsonb
  check (jsonb_typeof(promo_codes_json) = 'array');

alter table public.promotion_redemptions
  drop constraint if exists promotion_redemptions_order_id_key;

alter table public.promotion_redemptions
  add constraint promotion_redemptions_order_id_promotion_id_key
  unique (order_id, promotion_id);
