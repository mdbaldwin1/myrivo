-- Add sku mode metadata for variant-level SKU generation controls.

alter table public.product_variants
  add column if not exists sku_mode text not null default 'auto';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_sku_mode_check'
      and conrelid = 'public.product_variants'::regclass
  ) then
    alter table public.product_variants
      add constraint product_variants_sku_mode_check
      check (sku_mode in ('auto', 'manual'));
  end if;
end $$;

-- Preserve existing behavior: existing rows remain manual unless explicitly reset.
update public.product_variants
set sku_mode = 'manual'
where sku_mode is distinct from 'manual';
