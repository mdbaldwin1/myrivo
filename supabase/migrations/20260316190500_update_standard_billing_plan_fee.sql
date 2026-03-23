update public.billing_plans
set transaction_fee_bps = 400,
    transaction_fee_fixed_cents = 0,
    updated_at = now()
where key = 'standard';
