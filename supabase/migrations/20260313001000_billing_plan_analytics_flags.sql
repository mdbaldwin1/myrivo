update public.billing_plans
set feature_flags_json = coalesce(feature_flags_json, '{}'::jsonb) || '{"analytics": true}'::jsonb,
    updated_at = now()
where key in ('standard', 'family_friends');
