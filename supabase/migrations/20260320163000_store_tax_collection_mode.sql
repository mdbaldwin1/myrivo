alter table public.stores
  add column if not exists tax_collection_mode text not null default 'unconfigured',
  add column if not exists tax_compliance_acknowledged_at timestamptz,
  add column if not exists tax_compliance_acknowledged_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists tax_compliance_note text;

alter table public.stores drop constraint if exists stores_tax_collection_mode_check;

alter table public.stores
  add constraint stores_tax_collection_mode_check
  check (tax_collection_mode in ('unconfigured', 'stripe_tax', 'seller_attested_no_tax'));
