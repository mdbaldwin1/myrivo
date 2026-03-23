alter table public.promotions
  add column if not exists per_customer_redemption_limit integer
  check (per_customer_redemption_limit is null or per_customer_redemption_limit > 0);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_user_id uuid references public.user_profiles(id) on delete set null,
  customer_email_normalized text not null,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists idx_promotion_redemptions_store_id
  on public.promotion_redemptions(store_id);

create index if not exists idx_promotion_redemptions_promotion_email
  on public.promotion_redemptions(promotion_id, customer_email_normalized);

create index if not exists idx_promotion_redemptions_promotion_user
  on public.promotion_redemptions(promotion_id, customer_user_id)
  where customer_user_id is not null;

alter table public.promotion_redemptions enable row level security;

create policy promotion_redemptions_owner_all on public.promotion_redemptions
for all
using (
  exists (
    select 1
    from public.stores s
    where s.id = promotion_redemptions.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = promotion_redemptions.store_id
      and s.owner_user_id = auth.uid()
  )
);
