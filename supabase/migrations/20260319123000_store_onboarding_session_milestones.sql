alter table public.store_onboarding_sessions
  add column if not exists first_product_completed_at timestamptz,
  add column if not exists reveal_viewed_at timestamptz,
  add column if not exists preview_home_viewed_at timestamptz,
  add column if not exists preview_products_viewed_at timestamptz,
  add column if not exists preview_about_viewed_at timestamptz,
  add column if not exists studio_handoff_at timestamptz,
  add column if not exists catalog_handoff_at timestamptz,
  add column if not exists payments_handoff_at timestamptz,
  add column if not exists launch_checklist_handoff_at timestamptz;

create index if not exists idx_store_onboarding_sessions_reveal_viewed_at
  on public.store_onboarding_sessions(reveal_viewed_at);

create index if not exists idx_store_onboarding_sessions_first_product_completed_at
  on public.store_onboarding_sessions(first_product_completed_at);
