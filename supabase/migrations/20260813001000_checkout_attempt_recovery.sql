-- Make a storefront checkout attempt the durable idempotency boundary. A
-- browser retry, concurrent double submit, or ambiguous Stripe response must
-- resolve to the same checkout row and therefore the same Stripe idempotency
-- key and digital purchase manifest.

alter table public.storefront_checkout_sessions
  add column if not exists checkout_attempt_key text,
  add column if not exists checkout_request_fingerprint_sha256 text,
  add column if not exists stripe_checkout_url text;

alter table public.storefront_checkout_sessions
  add constraint storefront_checkout_sessions_attempt_key_check
    check (
      checkout_attempt_key is null
      or (
        char_length(checkout_attempt_key) between 16 and 128
        and checkout_attempt_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$'
      )
    ),
  add constraint storefront_checkout_sessions_request_fingerprint_check
    check (
      checkout_request_fingerprint_sha256 is null
      or checkout_request_fingerprint_sha256 ~ '^[a-f0-9]{64}$'
    ),
  add constraint storefront_checkout_sessions_attempt_identity_pair_check
    check (
      (checkout_attempt_key is null) =
      (checkout_request_fingerprint_sha256 is null)
    ),
  add constraint storefront_checkout_sessions_stripe_url_check
    check (
      stripe_checkout_url is null
      or (
        char_length(stripe_checkout_url) <= 2048
        and stripe_checkout_url ~ '^https://checkout[.]stripe[.]com/'
      )
    );

create unique index if not exists storefront_checkout_sessions_store_attempt_unique
  on public.storefront_checkout_sessions(store_id, checkout_attempt_key);

create or replace function public.enforce_storefront_checkout_attempt_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.checkout_attempt_key is not null
       and (
         new.checkout_attempt_key is distinct from old.checkout_attempt_key
         or new.checkout_request_fingerprint_sha256 is distinct from old.checkout_request_fingerprint_sha256
       )
    then
      raise exception 'Checkout attempt identity is immutable';
    end if;

    if old.stripe_checkout_session_id is not null
       and new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
    then
      raise exception 'Stripe checkout session binding is immutable';
    end if;

    if old.stripe_checkout_url is not null
       and new.stripe_checkout_url is distinct from old.stripe_checkout_url
    then
      raise exception 'Stripe checkout URL binding is immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_storefront_checkout_attempt_identity
on public.storefront_checkout_sessions;
create trigger enforce_storefront_checkout_attempt_identity
before insert or update of
  checkout_attempt_key,
  checkout_request_fingerprint_sha256,
  stripe_checkout_session_id,
  stripe_checkout_url
on public.storefront_checkout_sessions
for each row execute function public.enforce_storefront_checkout_attempt_identity();

create or replace function public.create_or_reuse_storefront_checkout_attempt(
  p_store_id uuid,
  p_checkout_attempt_key text,
  p_request_fingerprint_sha256 text,
  p_checkout jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_input public.storefront_checkout_sessions%rowtype;
  v_checkout public.storefront_checkout_sessions%rowtype;
  v_inserted boolean := false;
begin
  if p_store_id is null
     or p_checkout_attempt_key is null
     or char_length(p_checkout_attempt_key) not between 16 and 128
     or p_checkout_attempt_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$'
  then
    raise exception 'Checkout attempt key is invalid';
  end if;

  if p_request_fingerprint_sha256 is null
     or p_request_fingerprint_sha256 !~ '^[a-f0-9]{64}$'
  then
    raise exception 'Checkout request fingerprint is invalid';
  end if;

  if p_checkout is null or jsonb_typeof(p_checkout) <> 'object' then
    raise exception 'Checkout snapshot is invalid';
  end if;

  v_input := jsonb_populate_record(null::public.storefront_checkout_sessions, p_checkout);

  if coalesce(char_length(trim(v_input.store_slug)), 0) = 0
     or coalesce(char_length(trim(v_input.customer_email)), 0) = 0
     or v_input.items is null
     or jsonb_typeof(v_input.items) <> 'array'
     or jsonb_array_length(v_input.items) = 0
     or v_input.status is distinct from 'pending'
  then
    raise exception 'Checkout snapshot is invalid';
  end if;

  insert into public.storefront_checkout_sessions(
    store_id,
    store_slug,
    customer_email,
    customer_first_name,
    customer_last_name,
    customer_phone,
    customer_note,
    fulfillment_method,
    fulfillment_label,
    shipping_fee_cents,
    pickup_location_id,
    pickup_location_snapshot_json,
    pickup_window_start_at,
    pickup_window_end_at,
    pickup_timezone,
    promo_code,
    promo_codes_json,
    analytics_session_key,
    analytics_session_id,
    source_cart_id,
    fee_plan_key,
    fee_bps,
    fee_fixed_cents,
    item_total_cents,
    platform_fee_cents,
    attribution_json,
    items,
    digital_consent_version,
    digital_consent_accepted_at,
    digital_license_version,
    status,
    checkout_attempt_key,
    checkout_request_fingerprint_sha256
  ) values (
    p_store_id,
    v_input.store_slug,
    lower(trim(v_input.customer_email)),
    v_input.customer_first_name,
    v_input.customer_last_name,
    v_input.customer_phone,
    v_input.customer_note,
    v_input.fulfillment_method,
    v_input.fulfillment_label,
    coalesce(v_input.shipping_fee_cents, 0),
    v_input.pickup_location_id,
    v_input.pickup_location_snapshot_json,
    v_input.pickup_window_start_at,
    v_input.pickup_window_end_at,
    v_input.pickup_timezone,
    v_input.promo_code,
    coalesce(v_input.promo_codes_json, '[]'::jsonb),
    v_input.analytics_session_key,
    v_input.analytics_session_id,
    v_input.source_cart_id,
    v_input.fee_plan_key,
    v_input.fee_bps,
    v_input.fee_fixed_cents,
    v_input.item_total_cents,
    v_input.platform_fee_cents,
    coalesce(v_input.attribution_json, '{}'::jsonb),
    v_input.items,
    v_input.digital_consent_version,
    v_input.digital_consent_accepted_at,
    v_input.digital_license_version,
    'pending',
    p_checkout_attempt_key,
    p_request_fingerprint_sha256
  )
  on conflict (store_id, checkout_attempt_key) do nothing
  returning * into v_checkout;

  if found then
    v_inserted := true;
  else
    select * into v_checkout
    from public.storefront_checkout_sessions checkout
    where checkout.store_id = p_store_id
      and checkout.checkout_attempt_key = p_checkout_attempt_key
    for update;

    if not found then
      raise exception 'Checkout attempt could not be resolved';
    end if;
  end if;

  if v_checkout.checkout_request_fingerprint_sha256 is distinct from p_request_fingerprint_sha256 then
    raise exception 'Checkout attempt key was already used for different purchase details';
  end if;

  return to_jsonb(v_checkout) || jsonb_build_object('created', v_inserted);
end;
$$;

create or replace function public.bind_storefront_checkout_stripe_session(
  p_checkout_session_id uuid,
  p_store_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_checkout public.storefront_checkout_sessions%rowtype;
begin
  if p_checkout_session_id is null
     or p_store_id is null
     or p_stripe_checkout_session_id !~ '^cs_[A-Za-z0-9_]+$'
     or coalesce(char_length(p_stripe_checkout_session_id), 0) > 255
     or p_stripe_checkout_url !~ '^https://checkout[.]stripe[.]com/'
     or char_length(p_stripe_checkout_url) > 2048
  then
    raise exception 'Stripe checkout session binding is invalid';
  end if;

  select * into v_checkout
  from public.storefront_checkout_sessions checkout
  where checkout.id = p_checkout_session_id
    and checkout.store_id = p_store_id
  for update;

  if not found or v_checkout.checkout_attempt_key is null then
    raise exception 'Checkout attempt is unavailable';
  end if;
  if v_checkout.status not in ('pending', 'completed') then
    raise exception 'Checkout attempt is unavailable';
  end if;
  if v_checkout.stripe_checkout_session_id is not null
     and v_checkout.stripe_checkout_session_id <> p_stripe_checkout_session_id
  then
    raise exception 'Checkout attempt is already bound to another Stripe session';
  end if;
  if v_checkout.stripe_checkout_url is not null
     and v_checkout.stripe_checkout_url <> p_stripe_checkout_url
  then
    raise exception 'Checkout attempt is already bound to another Stripe URL';
  end if;

  update public.storefront_checkout_sessions
  set stripe_checkout_session_id = p_stripe_checkout_session_id,
      stripe_checkout_url = p_stripe_checkout_url,
      error_message = null
  where id = v_checkout.id
  returning * into v_checkout;

  return to_jsonb(v_checkout);
end;
$$;

revoke all on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb) from public;
revoke all on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb) from anon;
revoke all on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb) from authenticated;
grant execute on function public.create_or_reuse_storefront_checkout_attempt(uuid, text, text, jsonb) to service_role;

revoke all on function public.bind_storefront_checkout_stripe_session(uuid, uuid, text, text) from public;
revoke all on function public.bind_storefront_checkout_stripe_session(uuid, uuid, text, text) from anon;
revoke all on function public.bind_storefront_checkout_stripe_session(uuid, uuid, text, text) from authenticated;
grant execute on function public.bind_storefront_checkout_stripe_session(uuid, uuid, text, text) to service_role;
