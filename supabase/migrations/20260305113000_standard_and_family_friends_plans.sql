insert into public.billing_plans (key, name, monthly_price_cents, transaction_fee_bps, transaction_fee_fixed_cents, feature_flags_json, active)
values
  ('standard', 'Standard', 0, 125, 25, '{"prioritySupport": false, "customDomain": true}'::jsonb, true),
  ('family_friends', 'Family & Friends', 0, 0, 0, '{"prioritySupport": false, "customDomain": true, "internalOnly": true}'::jsonb, true)
on conflict (key) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  transaction_fee_bps = excluded.transaction_fee_bps,
  transaction_fee_fixed_cents = excluded.transaction_fee_fixed_cents,
  feature_flags_json = excluded.feature_flags_json,
  active = true,
  updated_at = now();

update public.billing_plans
set active = false,
    updated_at = now()
where key not in ('standard', 'family_friends');

insert into public.store_billing_profiles (store_id, billing_plan_id)
select s.id, bp.id
from public.stores s
join public.billing_plans bp on bp.key = 'standard'
where not exists (
  select 1
  from public.store_billing_profiles sbp
  where sbp.store_id = s.id
);

update public.store_billing_profiles sbp
set billing_plan_id = standard_plan.id,
    updated_at = now()
from public.billing_plans standard_plan
where standard_plan.key = 'standard'
  and (
    sbp.billing_plan_id is null
    or exists (
      select 1
      from public.billing_plans current_plan
      where current_plan.id = sbp.billing_plan_id
        and current_plan.key <> 'family_friends'
    )
  );
