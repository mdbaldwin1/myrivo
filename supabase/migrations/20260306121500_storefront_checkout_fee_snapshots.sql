alter table public.storefront_checkout_sessions
  add column if not exists fee_plan_key text,
  add column if not exists fee_bps integer check (fee_bps between 0 and 10000),
  add column if not exists fee_fixed_cents integer check (fee_fixed_cents >= 0),
  add column if not exists item_total_cents integer check (item_total_cents >= 0),
  add column if not exists platform_fee_cents integer check (platform_fee_cents >= 0);
