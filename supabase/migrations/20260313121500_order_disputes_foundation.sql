create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  reason text not null,
  status text not null check (status in ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost', 'prevented')),
  is_charge_refundable boolean not null default false,
  response_due_by timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_disputes_order_id_created_at on public.order_disputes(order_id, created_at desc);
create index if not exists idx_order_disputes_store_id_status on public.order_disputes(store_id, status);
create index if not exists idx_order_disputes_payment_intent on public.order_disputes(stripe_payment_intent_id);

drop trigger if exists order_disputes_set_updated_at on public.order_disputes;
create trigger order_disputes_set_updated_at
before update on public.order_disputes
for each row execute function public.set_updated_at();

alter table public.order_disputes enable row level security;

drop policy if exists order_disputes_store_read on public.order_disputes;
create policy order_disputes_store_read on public.order_disputes
for select
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = order_disputes.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);
