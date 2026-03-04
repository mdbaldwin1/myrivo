-- Seed intentionally minimal; run after creating a real auth user.
-- Example:
-- insert into public.stores (owner_user_id, name, slug, status)
-- values ('<auth-user-uuid>', 'At Home Apothecary', 'athomeapothacary', 'active');

-- Seed default policy FAQs for all stores if store_settings rows exist.
update public.store_settings
set policy_faqs = jsonb_build_array(
  jsonb_build_object(
    'id', 'faq-shipping-timing',
    'question', 'When will my order ship?',
    'answer', 'Most orders are packed and shipped within 2 to 4 business days. Tracking is sent by email as soon as your package is on the way.',
    'sort_order', 0,
    'is_active', true
  ),
  jsonb_build_object(
    'id', 'faq-returns',
    'question', 'What if I need to return an item?',
    'answer', 'Please review our return policy and contact support before sending an item back so we can help with eligibility and next steps.',
    'sort_order', 1,
    'is_active', true
  ),
  jsonb_build_object(
    'id', 'faq-support',
    'question', 'How can I get order help?',
    'answer', 'Email support with your order number and we will respond as soon as possible.',
    'sort_order', 2,
    'is_active', true
  )
)
where coalesce(jsonb_array_length(policy_faqs), 0) = 0;

update public.store_settings
set storefront_copy_json = '{}'::jsonb
where storefront_copy_json is null;

update public.store_settings
set
  email_capture_enabled = true,
  email_capture_heading = coalesce(email_capture_heading, 'Get product drops and restock alerts'),
  email_capture_description = coalesce(email_capture_description, 'One to two emails per month. Unsubscribe anytime.'),
  email_capture_success_message = coalesce(email_capture_success_message, 'Thanks for subscribing. You are on the list.')
where true;

-- Ensure stores without a settings row still get a seeded FAQ set.
insert into public.store_settings (
  store_id,
  policy_faqs,
  storefront_copy_json,
  email_capture_enabled,
  email_capture_heading,
  email_capture_description,
  email_capture_success_message
)
select
  s.id,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'faq-shipping-timing',
      'question', 'When will my order ship?',
      'answer', 'Most orders are packed and shipped within 2 to 4 business days. Tracking is sent by email as soon as your package is on the way.',
      'sort_order', 0,
      'is_active', true
    ),
    jsonb_build_object(
      'id', 'faq-returns',
      'question', 'What if I need to return an item?',
      'answer', 'Please review our return policy and contact support before sending an item back so we can help with eligibility and next steps.',
      'sort_order', 1,
      'is_active', true
    ),
    jsonb_build_object(
      'id', 'faq-support',
      'question', 'How can I get order help?',
      'answer', 'Email support with your order number and we will respond as soon as possible.',
      'sort_order', 2,
      'is_active', true
    )
  ),
  '{}'::jsonb,
  true,
  'Get product drops and restock alerts',
  'One to two emails per month. Unsubscribe anytime.',
  'Thanks for subscribing. You are on the list.'
from public.stores s
where not exists (
  select 1
  from public.store_settings ss
  where ss.store_id = s.id
);
