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

insert into public.store_settings (store_id, policy_faqs)
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
  )
from public.stores s
where not exists (
  select 1
  from public.store_settings ss
  where ss.store_id = s.id
);
