alter table public.store_billing_profiles
drop column if exists fee_override_bps,
drop column if exists fee_override_fixed_cents;

alter table public.stores
drop column if exists white_label_brand_name,
drop column if exists white_label_favicon_path;
