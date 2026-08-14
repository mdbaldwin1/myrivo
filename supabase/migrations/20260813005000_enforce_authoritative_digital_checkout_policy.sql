-- Determine whether checkout policy evidence is required from catalog-owned
-- product identity. Client snapshots remain useful for display/audit, but are
-- not a trusted source for product type or checkout composition.

create or replace function public.enforce_digital_checkout_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.digital_checkout_policy_versions%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_catalog_product_type text;
  v_contains_digital boolean := false;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    raise exception 'Checkout item snapshot is invalid';
  end if;

  for v_item in select * from jsonb_array_elements(new.items)
  loop
    v_product_id := nullif(v_item ->> 'productId', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variantId', '')::uuid;

    if v_product_id is null or v_variant_id is null then
      raise exception 'Checkout item identity is invalid';
    end if;

    select product.product_type into v_catalog_product_type
    from public.products product
    join public.product_variants variant
      on variant.id = v_variant_id
     and variant.product_id = product.id
     and variant.store_id = product.store_id
    where product.id = v_product_id
      and product.store_id = new.store_id;

    if not found then
      raise exception 'Checkout item does not belong to the selected store and product';
    end if;

    if v_catalog_product_type = 'digital' then
      v_contains_digital := true;
    end if;
  end loop;

  if not v_contains_digital then
    return new;
  end if;

  select * into v_policy
  from public.digital_checkout_policy_versions policy
  where policy.singleton = true;
  if not found then
    raise exception 'Digital checkout policy is not configured';
  end if;

  if new.digital_consent_version is distinct from v_policy.consent_version
     or new.digital_license_version is distinct from v_policy.license_version
     or new.digital_consent_accepted_at is null
     or new.digital_consent_accepted_at > statement_timestamp() + interval '5 minutes'
  then
    raise exception 'Digital checkout consent and license snapshot is invalid';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_digital_checkout_policy_snapshot()
from public, anon, authenticated, service_role;
