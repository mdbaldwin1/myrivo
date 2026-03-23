update public.billing_plans
set transaction_fee_bps = 290,
    transaction_fee_fixed_cents = 30,
    updated_at = now()
where key = 'family_friends';
