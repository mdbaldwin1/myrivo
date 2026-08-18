-- Rights and stock follow fulfillment down to the variant.
--
-- Two rules assumed a product was wholly one thing. A product whose own default
-- was physical had its rights affirmation erased on every write, so a painting
-- offering a download could never satisfy publishing readiness. And a product
-- whose default was digital had the stock of every variant zeroed, so a print
-- sold beside that download could never hold any.
--
-- Both now ask the variant.

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

  -- A rights affirmation covers the downloads a product sells, so it survives
  -- as long as the product sells one. Clearing it whenever the product's own
  -- default was physical made a painting that offers a download unpublishable:
  -- readiness demands rights the database refused to keep.
  if new.product_type = 'physical' and not exists (
    select 1 from public.product_variants variant
    where variant.product_id = new.id
      and variant.store_id = new.store_id
      and variant.status = 'active'
      and coalesce(variant.fulfillment_type, new.product_type) = 'digital'
  ) then
    new.digital_rights_affirmed_at := null;
    new.digital_rights_affirmed_by_user_id := null;
  end if;

  -- Stock is meaningless for a download and essential for anything posted, so
  -- it is zeroed per variant. Zeroing every variant of a digital product wiped
  -- the stock of a print sold alongside the download.
  if new.product_type = 'digital' and not exists (
    select 1 from public.product_variants variant
    where variant.product_id = new.id
      and variant.store_id = new.store_id
      and variant.status = 'active'
      and coalesce(variant.fulfillment_type, new.product_type) = 'physical'
  ) then
    new.inventory_qty := 0;
  end if;

  -- The atomic catalog RPC writes variants before changing product_type, so
  -- normalize existing children here too.
  update public.product_variants
  set inventory_qty = 0,
      is_made_to_order = false
  where product_id = new.id
    and store_id = new.store_id
    and coalesce(fulfillment_type, new.product_type) = 'digital'
    and (inventory_qty <> 0 or is_made_to_order);
  return new;
end;
$$;
