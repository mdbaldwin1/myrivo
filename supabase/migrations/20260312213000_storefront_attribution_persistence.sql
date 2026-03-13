alter table public.storefront_sessions
  add column if not exists first_entry_path text,
  add column if not exists first_referrer_url text,
  add column if not exists first_referrer_host text,
  add column if not exists first_utm_source text,
  add column if not exists first_utm_medium text,
  add column if not exists first_utm_campaign text,
  add column if not exists first_utm_term text,
  add column if not exists first_utm_content text,
  add column if not exists last_entry_path text,
  add column if not exists last_referrer_url text,
  add column if not exists last_referrer_host text,
  add column if not exists last_utm_source text,
  add column if not exists last_utm_medium text,
  add column if not exists last_utm_campaign text,
  add column if not exists last_utm_term text,
  add column if not exists last_utm_content text;

alter table public.storefront_checkout_sessions
  add column if not exists analytics_session_key text,
  add column if not exists attribution_json jsonb not null default '{}'::jsonb;
