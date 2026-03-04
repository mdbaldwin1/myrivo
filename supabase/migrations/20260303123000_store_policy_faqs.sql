alter table public.store_settings
  add column if not exists policy_faqs jsonb not null default '[]'::jsonb;

update public.store_settings
set policy_faqs = jsonb_build_array(
  jsonb_build_object(
    'id', 'faq-shipping-timing',
    'question', 'When will my order ship?',
    'answer', 'Most orders are packed and shipped within 2 to 4 business days. You will receive tracking by email once your package is on the way.',
    'sort_order', 0,
    'is_active', true
  ),
  jsonb_build_object(
    'id', 'faq-return-window',
    'question', 'What is your return policy?',
    'answer', 'Returns are accepted according to the return policy listed on this page. Please contact support before sending items back.',
    'sort_order', 1,
    'is_active', true
  ),
  jsonb_build_object(
    'id', 'faq-order-help',
    'question', 'How do I get help with my order?',
    'answer', 'If you need help, email support and include your order number so we can assist quickly.',
    'sort_order', 2,
    'is_active', true
  )
)
where coalesce(jsonb_array_length(policy_faqs), 0) = 0;
