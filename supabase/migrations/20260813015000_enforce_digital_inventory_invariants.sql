-- Digital goods are not stock-tracked or made to order. Enforce that invariant
-- beneath every API and RPC so stale or hostile clients cannot persist physical
-- fulfillment state on a digital catalog item.

update public.products
set inventory_qty = 0
where product_type = 'digital' and inventory_qty <> 0;

update public.product_variants variant
set inventory_qty = 0,
    is_made_to_order = false
from public.products product
where product.id = variant.product_id
  and product.store_id = variant.store_id
  and product.product_type = 'digital'
  and (variant.inventory_qty <> 0 or variant.is_made_to_order);

alter table public.products
  drop constraint if exists products_digital_inventory_zero_check;
alter table public.products
  add constraint products_digital_inventory_zero_check
  check (product_type <> 'digital' or inventory_qty = 0) not valid;
alter table public.products
  validate constraint products_digital_inventory_zero_check;

create or replace function public.enforce_product_type_conversion_safety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.product_type is distinct from new.product_type then
    if exists (
      select 1 from public.order_items oi
      where oi.product_id = old.id and oi.store_id = old.store_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Products with order history cannot change fulfillment type';
    end if;

    if old.product_type = 'physical' and new.product_type = 'digital'
      and (
        new.digital_rights_affirmed_at is null
        or new.digital_rights_affirmed_by_user_id is null
      )
    then
      raise exception using
        errcode = '23514',
        message = 'Fresh digital rights affirmation is required';
    end if;
  end if;

  if new.product_type = 'physical' then
    new.digital_rights_affirmed_at := null;
    new.digital_rights_affirmed_by_user_id := null;
  else
    new.inventory_qty := 0;
    -- The atomic catalog RPC writes variants before changing product_type.
    -- Normalize existing children here so physical-to-digital conversion is
    -- safe even when the RPC receives hostile inventory fields.
    update public.product_variants
    set inventory_qty = 0,
        is_made_to_order = false
    where product_id = new.id
      and store_id = new.store_id
      and (inventory_qty <> 0 or is_made_to_order);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_product_type_conversion_safety on public.products;
create trigger enforce_product_type_conversion_safety
before insert or update of product_type, digital_rights_affirmed_at,
  digital_rights_affirmed_by_user_id, inventory_qty
on public.products
for each row execute function public.enforce_product_type_conversion_safety();

create or replace function public.enforce_digital_variant_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.products product
    where product.id = new.product_id
      and product.store_id = new.store_id
      and product.product_type = 'digital'
  ) then
    new.inventory_qty := 0;
    new.is_made_to_order := false;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_digital_variant_inventory on public.product_variants;
create trigger enforce_digital_variant_inventory
before insert or update of product_id, store_id, inventory_qty, is_made_to_order
on public.product_variants
for each row execute function public.enforce_digital_variant_inventory();

revoke all on function public.enforce_product_type_conversion_safety()
from public, anon, authenticated;
revoke all on function public.enforce_digital_variant_inventory()
from public, anon, authenticated;
