-- Ensure every product has at least one product_variants row.
-- Non-variant products rely on this base row for inventory/price/SKU edits and order linkage.

insert into public.product_variants (
  store_id,
  product_id,
  title,
  sku,
  sku_mode,
  option_values,
  price_cents,
  inventory_qty,
  is_default,
  status,
  sort_order
)
select
  p.store_id,
  p.id,
  null,
  p.sku,
  'manual',
  '{}'::jsonb,
  p.price_cents,
  p.inventory_qty,
  true,
  case when p.status = 'archived' then 'archived' else 'active' end,
  0
from public.products p
where not exists (
  select 1
  from public.product_variants pv
  where pv.product_id = p.id
);
