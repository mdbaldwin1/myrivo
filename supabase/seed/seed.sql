-- Seed intentionally minimal; run after creating a real auth user.
-- Example:
-- insert into public.stores (owner_user_id, name, slug, status)
-- values ('<auth-user-uuid>', 'Sunset Mercantile', 'sunset-mercantile', 'active');

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

-- Comprehensive demo store: Margie's Flower Shop.
-- Uses Pexels-hosted free stock images for local/demo storefront realism.
do $$
declare
  v_owner_id uuid := '11111111-1111-4111-8111-111111111111';
  v_staff_id uuid := '11111111-1111-4111-8111-111111111112';
  v_store_id uuid := '22222222-2222-4222-8222-222222222222';
begin
  delete from public.stores where slug = 'margies-flower-shop';
  delete from auth.users
  where id in (
    v_owner_id,
    v_staff_id,
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8333-333333333332',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333334',
    '33333333-3333-4333-8333-333333333335',
    '33333333-3333-4333-8333-333333333336'
  );

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values
    (v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'margie.owner@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '90 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Margie Flores"}'::jsonb, now() - interval '90 days', now() - interval '90 days', '', '', '', ''),
    (v_staff_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lena.staff@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '85 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Lena Park"}'::jsonb, now() - interval '85 days', now() - interval '85 days', '', '', '', ''),
    ('33333333-3333-4333-8333-333333333331', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olivia.chen@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '44 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Olivia Chen"}'::jsonb, now() - interval '44 days', now() - interval '44 days', '', '', '', ''),
    ('33333333-3333-4333-8333-333333333332', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nate.rivera@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '39 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Nate Rivera"}'::jsonb, now() - interval '39 days', now() - interval '39 days', '', '', '', ''),
    ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya.shah@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '31 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Priya Shah"}'::jsonb, now() - interval '31 days', now() - interval '31 days', '', '', '', ''),
    ('33333333-3333-4333-8333-333333333334', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sasha.reed@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '24 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Sasha Reed"}'::jsonb, now() - interval '24 days', now() - interval '24 days', '', '', '', ''),
    ('33333333-3333-4333-8333-333333333335', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amanda.lee@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '18 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Amanda Lee"}'::jsonb, now() - interval '18 days', now() - interval '18 days', '', '', '', ''),
    ('33333333-3333-4333-8333-333333333336', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mateo.garcia@example.com', crypt('margies-demo-password', gen_salt('bf')), now() - interval '12 days', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Mateo Garcia"}'::jsonb, now() - interval '12 days', now() - interval '12 days', '', '', '', '')
  on conflict (id) do nothing;

  insert into public.user_profiles (id, email, display_name, global_role, metadata)
  values
    (v_owner_id, 'margie.owner@example.com', 'Margie Flores', 'user', '{"demo":"margies-flower-shop","persona":"owner"}'::jsonb),
    (v_staff_id, 'lena.staff@example.com', 'Lena Park', 'user', '{"demo":"margies-flower-shop","persona":"floral designer"}'::jsonb),
    ('33333333-3333-4333-8333-333333333331', 'olivia.chen@example.com', 'Olivia Chen', 'user', '{"demo":"margies-flower-shop","persona":"repeat gift buyer"}'::jsonb),
    ('33333333-3333-4333-8333-333333333332', 'nate.rivera@example.com', 'Nate Rivera', 'user', '{"demo":"margies-flower-shop","persona":"pickup customer"}'::jsonb),
    ('33333333-3333-4333-8333-333333333333', 'priya.shah@example.com', 'Priya Shah', 'user', '{"demo":"margies-flower-shop","persona":"event host"}'::jsonb),
    ('33333333-3333-4333-8333-333333333334', 'sasha.reed@example.com', 'Sasha Reed', 'user', '{"demo":"margies-flower-shop","persona":"anniversary shopper"}'::jsonb),
    ('33333333-3333-4333-8333-333333333335', 'amanda.lee@example.com', 'Amanda Lee', 'user', '{"demo":"margies-flower-shop","persona":"sympathy order"}'::jsonb),
    ('33333333-3333-4333-8333-333333333336', 'mateo.garcia@example.com', 'Mateo Garcia', 'user', '{"demo":"margies-flower-shop","persona":"subscriber"}'::jsonb)
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    global_role = excluded.global_role,
    metadata = excluded.metadata,
    updated_at = now();

  insert into public.stores (
    id,
    owner_user_id,
    name,
    slug,
    status,
    has_launched_once,
    default_pickup_radius_miles,
    stripe_account_id,
    tax_collection_mode,
    tax_compliance_acknowledged_at,
    tax_compliance_acknowledged_by_user_id,
    tax_compliance_note,
    is_featured,
    created_at,
    updated_at
  )
  values (
    v_store_id,
    v_owner_id,
    'Margie''s Flower Shop',
    'margies-flower-shop',
    'live',
    true,
    18,
    'acct_margies_demo',
    'seller_attested_no_tax',
    now() - interval '80 days',
    v_owner_id,
    'Demo store seed: local florist attestation captured for sample checkout flows.',
    true,
    now() - interval '90 days',
    now() - interval '2 hours'
  );

  insert into public.store_memberships (store_id, user_id, role, status, permissions_json)
  values
    (v_store_id, v_owner_id, 'owner', 'active', '{"*":true}'::jsonb),
    (v_store_id, v_staff_id, 'staff', 'active', '{"orders":"read","products":"write","reviews":"moderate"}'::jsonb)
  on conflict (store_id, user_id) do update set
    role = excluded.role,
    status = excluded.status,
    permissions_json = excluded.permissions_json,
    updated_at = now();

  insert into public.store_branding (
    store_id,
    logo_path,
    favicon_path,
    apple_touch_icon_path,
    og_image_path,
    twitter_image_path,
    primary_color,
    accent_color,
    theme_json
  )
  values (
    v_store_id,
    null,
    null,
    null,
    'https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/16160332/pexels-photo-16160332.jpeg?auto=compress&cs=tinysrgb&w=1600',
    '#245447',
    '#d45b7a',
    '{"palette":{"cream":"#fff7ed","leaf":"#245447","rose":"#d45b7a","sun":"#f0b84f"},"radius":"6px","personality":"warm neighborhood florist with practical gifting flows"}'::jsonb
  )
  on conflict (store_id) do update set
    og_image_path = excluded.og_image_path,
    twitter_image_path = excluded.twitter_image_path,
    primary_color = excluded.primary_color,
    accent_color = excluded.accent_color,
    theme_json = excluded.theme_json,
    updated_at = now();

  insert into public.store_settings (
    store_id,
    support_email,
    fulfillment_message,
    shipping_policy,
    return_policy,
    announcement,
    seo_title,
    seo_description,
    seo_noindex,
    seo_location_city,
    seo_location_region,
    seo_location_state,
    seo_location_postal_code,
    seo_location_country_code,
    seo_location_address_line1,
    seo_location_address_line2,
    seo_location_show_full_address,
    footer_tagline,
    footer_note,
    instagram_url,
    facebook_url,
    tiktok_url,
    policy_faqs,
    about_article_html,
    about_sections,
    storefront_copy_json,
    email_capture_enabled,
    email_capture_heading,
    email_capture_description,
    email_capture_success_message,
    welcome_popup_enabled,
    welcome_popup_eyebrow,
    welcome_popup_headline,
    welcome_popup_body,
    welcome_popup_email_placeholder,
    welcome_popup_cta_label,
    welcome_popup_decline_label,
    welcome_popup_image_layout,
    welcome_popup_delay_seconds,
    welcome_popup_dismiss_days,
    checkout_enable_local_pickup,
    checkout_local_pickup_label,
    checkout_local_pickup_fee_cents,
    checkout_enable_flat_rate_shipping,
    checkout_flat_rate_shipping_label,
    checkout_flat_rate_shipping_fee_cents,
    checkout_allow_order_note,
    checkout_order_note_prompt,
    checkout_max_promo_codes,
    checkout_notice,
    store_alert_enabled,
    store_alert_title,
    store_alert_message,
    store_alert_delay_seconds,
    store_alert_dismiss_days
  )
  values (
    v_store_id,
    'hello@margiesflowers.example',
    'Fresh arrangements are designed each morning. Same-day pickup is available until 3 PM for in-stock stems.',
    'Local deliveries leave the shop Tuesday through Saturday. Regional gift boxes ship in insulated packaging within 1 to 2 business days.',
    'Perishable floral orders are final sale, but Margie will replace any arrangement that arrives damaged or meaningfully below our freshness standard.',
    'Mother''s Day weekend slots are filling quickly. Reserve pickup windows early.',
    'Margie''s Flower Shop | Bouquets, plants, and sweet gifts',
    'Neighborhood flower shop demo with roses, seasonal bouquets, potted plants, chocolates, subscriptions, reviews, and pickup-friendly ordering.',
    false,
    'Maplewood',
    'Essex County',
    'NJ',
    '07040',
    'US',
    '18 Rosewater Lane',
    'Suite B',
    true,
    'Flowers with an actual human behind them.',
    'Demo storefront for Myrivo local commerce workflows.',
    'https://instagram.com/margiesflowers',
    'https://facebook.com/margiesflowers',
    'https://tiktok.com/@margiesflowers',
    jsonb_build_array(
      jsonb_build_object('id','faq-same-day','question','Can I get same-day flowers?','answer','Yes. Order active in-stock bouquets before 3 PM Tuesday through Saturday for same-day pickup or local delivery.', 'sort_order',0,'is_active',true),
      jsonb_build_object('id','faq-substitution','question','Will my bouquet match the photo exactly?','answer','Photos show the palette and style. Margie may substitute equal or better blooms when a stem is out of season.', 'sort_order',1,'is_active',true),
      jsonb_build_object('id','faq-care','question','How long should arrangements last?','answer','Most fresh bouquets last 5 to 7 days with clean water, a cool room, and trimmed stems every other day.', 'sort_order',2,'is_active',true)
    ),
    '<h2>Built around the morning flower run</h2><p>Margie buys in small batches, designs by hand, and keeps the catalog honest about what is fresh today.</p><p>The shop specializes in giftable bouquets, sympathy plants, date-night bundles, and small celebration add-ons.</p>',
    jsonb_build_array(
      jsonb_build_object('id','design-bar','eyebrow','Design bar','title','Seasonal stems, composed to order','body','Choose a palette or stem count and the team builds the arrangement from the morning cooler.', 'imageUrl','https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'),
      jsonb_build_object('id','plant-corner','eyebrow','Plant corner','title','Potted blooms and hardy greens','body','Orchids, succulents, peace lilies, and easy-care add-ons for longer-lived gifts.', 'imageUrl','https://images.pexels.com/photos/8281376/pexels-photo-8281376.jpeg?auto=compress&cs=tinysrgb&w=1200')
    ),
    '{"hero":{"eyebrow":"Maplewood florist","headline":"Fresh flowers, plants, and little luxuries from Margie''s bench","body":"Order roses by color and stem count, grab a seasonal bouquet, or add chocolates when the occasion deserves a little extra.","primaryCta":"Shop arrangements","secondaryCta":"Send a gift today"},"products":{"heading":"Today''s flower bench","subheading":"Fresh-cut bouquets, potted plants, sweets, and care extras."},"reviews":{"heading":"Notes from the neighborhood"},"cart":{"emptyState":"Your bouquet box is empty."}}'::jsonb,
    true,
    'Get Margie''s stem list',
    'Weekly flower notes, early holiday windows, and first dibs on low-quantity plants.',
    'You are on Margie''s list. Watch for the next fresh-stem note.',
    true,
    'Fresh list',
    'Need the good stems before everyone else?',
    'Join the weekly stem list for early access to roses, orchids, and chocolate bundles.',
    'you@example.com',
    'Join the stem list',
    'Maybe later',
    'side',
    5,
    10,
    true,
    'Pickup at Margie''s design bench',
    0,
    true,
    'Local delivery or regional shipping',
    995,
    true,
    'Card message, delivery note, or flower allergies?',
    3,
    'Fresh flowers are temperature-sensitive. Please choose a pickup or delivery window where someone can receive them.',
    true,
    'Today''s cooler note',
    'White 36-stem rose bundles and charcoal orchid bowls are on waitlist only. Join the back-in-stock alert on the product page.',
    7,
    5
  )
  on conflict (store_id) do update set
    support_email = excluded.support_email,
    fulfillment_message = excluded.fulfillment_message,
    shipping_policy = excluded.shipping_policy,
    return_policy = excluded.return_policy,
    announcement = excluded.announcement,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    seo_noindex = excluded.seo_noindex,
    seo_location_city = excluded.seo_location_city,
    seo_location_region = excluded.seo_location_region,
    seo_location_state = excluded.seo_location_state,
    seo_location_postal_code = excluded.seo_location_postal_code,
    seo_location_country_code = excluded.seo_location_country_code,
    seo_location_address_line1 = excluded.seo_location_address_line1,
    seo_location_address_line2 = excluded.seo_location_address_line2,
    seo_location_show_full_address = excluded.seo_location_show_full_address,
    footer_tagline = excluded.footer_tagline,
    footer_note = excluded.footer_note,
    instagram_url = excluded.instagram_url,
    facebook_url = excluded.facebook_url,
    tiktok_url = excluded.tiktok_url,
    policy_faqs = excluded.policy_faqs,
    about_article_html = excluded.about_article_html,
    about_sections = excluded.about_sections,
    storefront_copy_json = excluded.storefront_copy_json,
    email_capture_enabled = excluded.email_capture_enabled,
    email_capture_heading = excluded.email_capture_heading,
    email_capture_description = excluded.email_capture_description,
    email_capture_success_message = excluded.email_capture_success_message,
    welcome_popup_enabled = excluded.welcome_popup_enabled,
    welcome_popup_eyebrow = excluded.welcome_popup_eyebrow,
    welcome_popup_headline = excluded.welcome_popup_headline,
    welcome_popup_body = excluded.welcome_popup_body,
    welcome_popup_email_placeholder = excluded.welcome_popup_email_placeholder,
    welcome_popup_cta_label = excluded.welcome_popup_cta_label,
    welcome_popup_decline_label = excluded.welcome_popup_decline_label,
    welcome_popup_image_layout = excluded.welcome_popup_image_layout,
    welcome_popup_delay_seconds = excluded.welcome_popup_delay_seconds,
    welcome_popup_dismiss_days = excluded.welcome_popup_dismiss_days,
    checkout_enable_local_pickup = excluded.checkout_enable_local_pickup,
    checkout_local_pickup_label = excluded.checkout_local_pickup_label,
    checkout_local_pickup_fee_cents = excluded.checkout_local_pickup_fee_cents,
    checkout_enable_flat_rate_shipping = excluded.checkout_enable_flat_rate_shipping,
    checkout_flat_rate_shipping_label = excluded.checkout_flat_rate_shipping_label,
    checkout_flat_rate_shipping_fee_cents = excluded.checkout_flat_rate_shipping_fee_cents,
    checkout_allow_order_note = excluded.checkout_allow_order_note,
    checkout_order_note_prompt = excluded.checkout_order_note_prompt,
    checkout_max_promo_codes = excluded.checkout_max_promo_codes,
    checkout_notice = excluded.checkout_notice,
    store_alert_enabled = excluded.store_alert_enabled,
    store_alert_title = excluded.store_alert_title,
    store_alert_message = excluded.store_alert_message,
    store_alert_delay_seconds = excluded.store_alert_delay_seconds,
    store_alert_dismiss_days = excluded.store_alert_dismiss_days,
    updated_at = now();

  insert into public.store_domains (
    store_id,
    domain,
    is_primary,
    verification_status,
    verification_token,
    last_verification_at,
    verified_at,
    hosting_provider,
    hosting_status,
    hosting_last_checked_at,
    hosting_ready_at,
    hosting_metadata_json,
    email_provider,
    email_sender_enabled,
    email_status,
    email_domain_id,
    email_last_checked_at,
    email_ready_at,
    email_metadata_json
  )
  values (
    v_store_id,
    'flowers.margies-demo.example',
    true,
    'verified',
    'margies-demo-verification',
    now() - interval '70 days',
    now() - interval '70 days',
    'vercel',
    'ready',
    now() - interval '69 days',
    now() - interval '69 days',
    '{"demo":true,"provider":"vercel"}'::jsonb,
    'resend',
    true,
    'ready',
    'domain_margies_demo',
    now() - interval '69 days',
    now() - interval '69 days',
    '{"demo":true,"sender":"hello@margiesflowers.example"}'::jsonb
  )
  on conflict (domain) do update set
    store_id = excluded.store_id,
    is_primary = excluded.is_primary,
    verification_status = excluded.verification_status,
    verification_token = excluded.verification_token,
    last_verification_at = excluded.last_verification_at,
    verified_at = excluded.verified_at,
    hosting_status = excluded.hosting_status,
    hosting_last_checked_at = excluded.hosting_last_checked_at,
    hosting_ready_at = excluded.hosting_ready_at,
    hosting_metadata_json = excluded.hosting_metadata_json,
    email_sender_enabled = excluded.email_sender_enabled,
    email_status = excluded.email_status,
    email_domain_id = excluded.email_domain_id,
    email_last_checked_at = excluded.email_last_checked_at,
    email_ready_at = excluded.email_ready_at,
    email_metadata_json = excluded.email_metadata_json,
    updated_at = now();

  insert into public.store_pickup_settings (
    store_id,
    pickup_enabled,
    selection_mode,
    geolocation_fallback_mode,
    out_of_radius_behavior,
    eligibility_radius_miles,
    lead_time_hours,
    slot_interval_minutes,
    show_pickup_times,
    timezone,
    instructions
  )
  values (
    v_store_id,
    true,
    'buyer_select',
    'allow_without_distance',
    'disable_pickup',
    18,
    4,
    30,
    true,
    'America/New_York',
    'Pickup at the side counter. Bring your order number and ask for the cooler hold shelf.'
  )
  on conflict (store_id) do update set
    pickup_enabled = excluded.pickup_enabled,
    selection_mode = excluded.selection_mode,
    geolocation_fallback_mode = excluded.geolocation_fallback_mode,
    out_of_radius_behavior = excluded.out_of_radius_behavior,
    eligibility_radius_miles = excluded.eligibility_radius_miles,
    lead_time_hours = excluded.lead_time_hours,
    slot_interval_minutes = excluded.slot_interval_minutes,
    show_pickup_times = excluded.show_pickup_times,
    timezone = excluded.timezone,
    instructions = excluded.instructions,
    updated_at = now();

  insert into public.pickup_locations (
    id,
    store_id,
    name,
    address_line1,
    address_line2,
    city,
    state_region,
    postal_code,
    country_code,
    latitude,
    longitude,
    notes,
    is_active
  )
  values (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    v_store_id,
    'Margie''s design bench',
    '18 Rosewater Lane',
    'Suite B',
    'Maplewood',
    'NJ',
    '07040',
    'US',
    40.7312,
    -74.2735,
    'Use the side entrance with the green awning.',
    true
  )
  on conflict (id) do update set
    name = excluded.name,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    city = excluded.city,
    state_region = excluded.state_region,
    postal_code = excluded.postal_code,
    country_code = excluded.country_code,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    notes = excluded.notes,
    is_active = excluded.is_active,
    updated_at = now();

  insert into public.pickup_location_hours (pickup_location_id, day_of_week, opens_at, closes_at)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', hours.day_of_week, hours.opens_at::time, hours.closes_at::time
  from (
    values
      (2, '10:00', '18:00'),
      (3, '10:00', '18:00'),
      (4, '10:00', '18:00'),
      (5, '10:00', '18:00'),
      (6, '09:00', '15:00')
  ) as hours(day_of_week, opens_at, closes_at)
  where not exists (
    select 1
    from public.pickup_location_hours existing
    where existing.pickup_location_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
      and existing.day_of_week = hours.day_of_week
  );
end $$;

insert into public.products (
  store_id,
  title,
  description,
  slug,
  sku,
  image_urls,
  image_alt_text,
  seo_title,
  seo_description,
  is_featured,
  price_cents,
  inventory_qty,
  status,
  created_at
)
values
  ('22222222-2222-4222-8222-222222222222','Rose Builder Bouquet','Classic long-stem roses wrapped with baby''s breath and seasonal greenery. Pick the color and stem count for anniversaries, apologies, proposals, or spectacular kitchen-table energy.','rose-builder-bouquet','MG-ROSE-BUILDER',array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Red roses with baby''s breath beside an open chocolate box.','Rose Builder Bouquet','Choose rose color and stem count for a custom wrapped bouquet from Margie''s Flower Shop.',true,4800,0,'active',now() - interval '70 days'),
  ('22222222-2222-4222-8222-222222222222','Sunlit Market Bouquet','A bright mixed bouquet with sunflower, carnation, daisy, and seasonal filler stems. Built for birthdays, thank-yous, and desks that deserve better lighting.','sunlit-market-bouquet','MG-SUNLIT',array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/11433758/pexels-photo-11433758.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Rows of sunny mixed bouquets in kraft wrap.','Sunlit Market Bouquet','Cheerful mixed sunflower bouquet in three sizes.',true,4200,0,'active',now() - interval '68 days'),
  ('22222222-2222-4222-8222-222222222222','Orchid Luxury Bowl','A double-stem phalaenopsis orchid planted in a ceramic bowl with moss and a care card. Elegant, longer-lived, and quietly dramatic.','orchid-luxury-bowl','MG-ORCHID-BOWL',array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/14097746/pexels-photo-14097746.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Flower shop display with orchids and potted flowering plants.','Orchid Luxury Bowl','Potted phalaenopsis orchid gift bowl with ceramic color options.',true,7600,0,'active',now() - interval '66 days'),
  ('22222222-2222-4222-8222-222222222222','Succulent Dish Garden','A low-water succulent arrangement with varied texture, stone top dressing, and a handwritten care tag. Excellent for offices and forgetful plant parents.','succulent-dish-garden','MG-SUCCULENT-GARDEN',array['https://images.pexels.com/photos/8281376/pexels-photo-8281376.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/14097746/pexels-photo-14097746.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Succulents arranged in nursery pots on a greenhouse shelf.','Succulent Dish Garden','Low-water succulent arrangement in compact and tall planters.',false,3800,0,'active',now() - interval '60 days'),
  ('22222222-2222-4222-8222-222222222222','Sympathy Peace Lily','A graceful peace lily in a neutral pot with a simple ribbon and care note. Margie keeps the presentation soft, respectful, and delivery-ready.','sympathy-peace-lily','MG-PEACE-LILY',array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Potted plants and flowering plants at a local flower shop.','Sympathy Peace Lily','Respectful potted peace lily gift with ribbon and care note.',false,5800,0,'active',now() - interval '58 days'),
  ('22222222-2222-4222-8222-222222222222','Designer''s Choice Bouquet','Let Margie pick from the morning cooler. Choose a mood and the shop builds a fresh arrangement with the best stems on hand.','designers-choice-bouquet','MG-DESIGNER-CHOICE',array['https://images.pexels.com/photos/16160332/pexels-photo-16160332.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/31788089/pexels-photo-31788089.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Colorful flower arrangements displayed in vases at a florist shop.','Designer''s Choice Bouquet','Seasonal florist-choice bouquet by mood.',true,6200,0,'active',now() - interval '56 days'),
  ('22222222-2222-4222-8222-222222222222','House Truffle Box','Small-batch chocolate truffles from Margie''s favorite local chocolatier. Add them to flowers or send them solo when the stems already did their job.','house-truffle-box','MG-TRUFFLES',array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Chocolate truffles in a gift box.','House Truffle Box','Giftable chocolate truffles in three box sizes.',false,2800,0,'active',now() - interval '54 days'),
  ('22222222-2222-4222-8222-222222222222','Date Night Flowers + Chocolate','A wrapped bouquet paired with house truffles and a tiny card. Slightly over the top in exactly the correct way.','date-night-flowers-chocolate','MG-DATE-NIGHT',array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/29098396/pexels-photo-29098396.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Red roses and assorted chocolates arranged together.','Date Night Flowers and Chocolate','Flowers and chocolate gift bundle with bouquet style options.',true,9800,0,'active',now() - interval '52 days'),
  ('22222222-2222-4222-8222-222222222222','Dried Lavender Bundle','Fragrant dried lavender tied with cotton ribbon. Good for linen closets, nightstands, and anyone who likes gifts that linger.','dried-lavender-bundle','MG-LAVENDER',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Florist arranging a bouquet with delicate stems and greenery.','Dried Lavender Bundle','Ribbon-tied dried lavender gift bundle.',false,2400,0,'active',now() - interval '48 days'),
  ('22222222-2222-4222-8222-222222222222','Flower Care Kit','A practical add-on with flower food, a tiny stem trimmer, care card, and a packet of vase-cleaning powder. Glamour, but responsible.','flower-care-kit','MG-CARE-KIT',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Hands arranging fresh flowers in a clear vase.','Flower Care Kit','Flower food and care tools to extend bouquet life.',false,1800,0,'active',now() - interval '45 days'),
  ('22222222-2222-4222-8222-222222222222','Bud Vase Trio','Three small vase arrangements for dinner tables, bedside surprises, or spreading flowers across a room instead of one dramatic centerpiece.','bud-vase-trio','MG-BUD-VASE-TRIO',array['https://images.pexels.com/photos/6045195/pexels-photo-6045195.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/27010563/pexels-photo-27010563.jpeg?auto=compress&cs=tinysrgb&w=1200'],'Pink gerbera flowers arranged in a small ceramic vase.','Bud Vase Trio','Set of three small flower arrangements with palette options.',false,3600,0,'active',now() - interval '42 days'),
  ('22222222-2222-4222-8222-222222222222','Saturday Bouquet Workshop','A two-hour in-shop class with seasonal stems, tools, snacks, and Margie gently stopping you from putting every focal flower on one side.','saturday-bouquet-workshop','MG-WORKSHOP',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'A person arranging a colorful bouquet in a vase.','Saturday Bouquet Workshop','Ticketed in-shop bouquet workshop dates.',false,6500,0,'active',now() - interval '40 days')
on conflict (store_id, sku) where sku is not null do update set
  title = excluded.title,
  description = excluded.description,
  slug = excluded.slug,
  image_urls = excluded.image_urls,
  image_alt_text = excluded.image_alt_text,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  is_featured = excluded.is_featured,
  price_cents = excluded.price_cents,
  status = excluded.status,
  updated_at = now();

insert into public.product_variants (
  store_id,
  product_id,
  title,
  sku,
  sku_mode,
  image_urls,
  group_image_urls,
  option_values,
  price_cents,
  inventory_qty,
  is_made_to_order,
  is_default,
  status,
  sort_order,
  created_at
)
select
  p.store_id,
  p.id,
  v.title,
  v.sku,
  'manual',
  v.image_urls,
  v.group_image_urls,
  v.option_values,
  v.price_cents,
  v.inventory_qty,
  v.is_made_to_order,
  v.is_default,
  'active',
  v.sort_order,
  now() - interval '35 days'
from (
  values
    ('MG-ROSE-BUILDER','12 red roses','MG-ROSE-RED-12',array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"Red","Stem count":"12"}'::jsonb,4800,18,false,true,0),
    ('MG-ROSE-BUILDER','24 red roses','MG-ROSE-RED-24',array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"Red","Stem count":"24"}'::jsonb,8800,9,false,false,1),
    ('MG-ROSE-BUILDER','36 red roses','MG-ROSE-RED-36',array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"Red","Stem count":"36"}'::jsonb,12600,4,false,false,2),
    ('MG-ROSE-BUILDER','12 pink roses','MG-ROSE-PINK-12',array['https://images.pexels.com/photos/11433758/pexels-photo-11433758.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/11433758/pexels-photo-11433758.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"Pink","Stem count":"12"}'::jsonb,4800,14,false,false,3),
    ('MG-ROSE-BUILDER','24 pink roses','MG-ROSE-PINK-24',array['https://images.pexels.com/photos/11433758/pexels-photo-11433758.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/11433758/pexels-photo-11433758.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"Pink","Stem count":"24"}'::jsonb,8800,8,false,false,4),
    ('MG-ROSE-BUILDER','36 pink roses','MG-ROSE-PINK-36',array['https://images.pexels.com/photos/31788089/pexels-photo-31788089.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/31788089/pexels-photo-31788089.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"Pink","Stem count":"36"}'::jsonb,12600,2,false,false,5),
    ('MG-ROSE-BUILDER','12 white roses','MG-ROSE-WHITE-12',array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"White","Stem count":"12"}'::jsonb,5200,7,false,false,6),
    ('MG-ROSE-BUILDER','24 white roses','MG-ROSE-WHITE-24',array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"White","Stem count":"24"}'::jsonb,9400,3,false,false,7),
    ('MG-ROSE-BUILDER','36 white roses','MG-ROSE-WHITE-36',array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Color":"White","Stem count":"36"}'::jsonb,13500,0,false,false,8),
    ('MG-SUNLIT','Petite','MG-SUNLIT-PETITE',array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Size":"Petite"}'::jsonb,4200,16,false,true,0),
    ('MG-SUNLIT','Signature','MG-SUNLIT-SIGNATURE',array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Size":"Signature"}'::jsonb,6800,12,false,false,1),
    ('MG-SUNLIT','Grand','MG-SUNLIT-GRAND',array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Size":"Grand"}'::jsonb,9800,5,false,false,2),
    ('MG-ORCHID-BOWL','White ceramic bowl','MG-ORCHID-WHITE',array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Pot":"White ceramic"}'::jsonb,7600,6,false,true,0),
    ('MG-ORCHID-BOWL','Charcoal ceramic bowl','MG-ORCHID-CHARCOAL',array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Pot":"Charcoal ceramic"}'::jsonb,8200,0,false,false,1),
    ('MG-SUCCULENT-GARDEN','Low dish','MG-SUCCULENT-LOW',array['https://images.pexels.com/photos/8281376/pexels-photo-8281376.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/8281376/pexels-photo-8281376.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Planter":"Low dish"}'::jsonb,3800,11,false,true,0),
    ('MG-SUCCULENT-GARDEN','Tall ceramic','MG-SUCCULENT-TALL',array['https://images.pexels.com/photos/8281376/pexels-photo-8281376.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/8281376/pexels-photo-8281376.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Planter":"Tall ceramic"}'::jsonb,5200,4,false,false,1),
    ('MG-PEACE-LILY','Ribboned plant','MG-PEACE-LILY-STD',array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{}'::jsonb,5800,5,false,true,0),
    ('MG-DESIGNER-CHOICE','Soft and pastel','MG-DESIGNER-SOFT',array['https://images.pexels.com/photos/16160332/pexels-photo-16160332.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/16160332/pexels-photo-16160332.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Mood":"Soft and pastel"}'::jsonb,6200,9,true,true,0),
    ('MG-DESIGNER-CHOICE','Bright and cheerful','MG-DESIGNER-BRIGHT',array['https://images.pexels.com/photos/31788089/pexels-photo-31788089.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/31788089/pexels-photo-31788089.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Mood":"Bright and cheerful"}'::jsonb,6200,10,true,false,1),
    ('MG-DESIGNER-CHOICE','Moody and romantic','MG-DESIGNER-MOODY',array['https://images.pexels.com/photos/19829670/pexels-photo-19829670.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19829670/pexels-photo-19829670.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Mood":"Moody and romantic"}'::jsonb,7200,6,true,false,2),
    ('MG-TRUFFLES','12-piece box','MG-TRUFFLES-12',array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Box size":"12 pieces"}'::jsonb,2800,20,false,true,0),
    ('MG-TRUFFLES','24-piece box','MG-TRUFFLES-24',array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Box size":"24 pieces"}'::jsonb,4800,0,false,false,1),
    ('MG-TRUFFLES','48-piece box','MG-TRUFFLES-48',array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/19121798/pexels-photo-19121798.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Box size":"48 pieces"}'::jsonb,8600,4,false,false,2),
    ('MG-DATE-NIGHT','Red roses bundle','MG-DATE-ROSE',array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Bouquet":"Red roses"}'::jsonb,9800,8,false,true,0),
    ('MG-DATE-NIGHT','Seasonal luxe bundle','MG-DATE-SEASONAL',array['https://images.pexels.com/photos/29098396/pexels-photo-29098396.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/29098396/pexels-photo-29098396.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Bouquet":"Seasonal luxe"}'::jsonb,10800,5,false,false,1),
    ('MG-LAVENDER','Ribbon-tied bundle','MG-LAVENDER-STD',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{}'::jsonb,2400,24,false,true,0),
    ('MG-CARE-KIT','Care kit','MG-CARE-KIT-STD',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{}'::jsonb,1800,30,false,true,0),
    ('MG-BUD-VASE-TRIO','Pink trio','MG-BUD-PINK',array['https://images.pexels.com/photos/6045195/pexels-photo-6045195.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/6045195/pexels-photo-6045195.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Palette":"Pink"}'::jsonb,3600,10,false,true,0),
    ('MG-BUD-VASE-TRIO','White trio','MG-BUD-WHITE',array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/2879819/pexels-photo-2879819.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Palette":"White"}'::jsonb,3600,7,false,false,1),
    ('MG-BUD-VASE-TRIO','Mixed trio','MG-BUD-MIXED',array['https://images.pexels.com/photos/27010563/pexels-photo-27010563.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/27010563/pexels-photo-27010563.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Palette":"Mixed"}'::jsonb,3900,12,false,false,2),
    ('MG-WORKSHOP','May 23 workshop','MG-WORKSHOP-MAY23',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Date":"May 23","Time":"10 AM"}'::jsonb,6500,0,true,true,0),
    ('MG-WORKSHOP','June 6 workshop','MG-WORKSHOP-JUN06',array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],array['https://images.pexels.com/photos/7858815/pexels-photo-7858815.jpeg?auto=compress&cs=tinysrgb&w=1200'],'{"Date":"June 6","Time":"2 PM"}'::jsonb,6500,8,true,false,1)
) as v(product_sku,title,sku,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,sort_order)
join public.products p on p.store_id = '22222222-2222-4222-8222-222222222222' and p.sku = v.product_sku
on conflict (store_id, lower(sku)) where sku is not null do update set
  title = excluded.title,
  product_id = excluded.product_id,
  sku_mode = excluded.sku_mode,
  image_urls = excluded.image_urls,
  group_image_urls = excluded.group_image_urls,
  option_values = excluded.option_values,
  price_cents = excluded.price_cents,
  inventory_qty = excluded.inventory_qty,
  is_made_to_order = excluded.is_made_to_order,
  is_default = excluded.is_default,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

with option_entries as (
  select
    pv.store_id,
    pv.product_id,
    pv.id as variant_id,
    pv.sort_order as variant_sort,
    kv.key as axis_name,
    kv.value as option_value
  from public.product_variants pv
  cross join lateral jsonb_each_text(coalesce(pv.option_values, '{}'::jsonb)) kv
  where pv.store_id = '22222222-2222-4222-8222-222222222222'
),
axis_rows as (
  insert into public.product_option_axes (store_id, product_id, name, sort_order)
  select store_id, product_id, axis_name, dense_rank() over (partition by product_id order by min(variant_sort), axis_name) - 1
  from option_entries
  group by store_id, product_id, axis_name
  on conflict (product_id, lower(name)) do update set
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id
),
value_rows as (
  insert into public.product_option_values (store_id, product_id, axis_id, value, sort_order)
  select
    oe.store_id,
    oe.product_id,
    a.id,
    oe.option_value,
    dense_rank() over (partition by a.id order by min(oe.variant_sort), oe.option_value) - 1
  from option_entries oe
  join public.product_option_axes a
    on a.product_id = oe.product_id
   and lower(a.name) = lower(oe.axis_name)
  group by oe.store_id, oe.product_id, a.id, oe.option_value
  on conflict (axis_id, lower(value)) do update set
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now()
  returning id
)
insert into public.product_variant_option_values (variant_id, axis_id, value_id)
select oe.variant_id, a.id, pov.id
from option_entries oe
join public.product_option_axes a
  on a.product_id = oe.product_id
 and lower(a.name) = lower(oe.axis_name)
join public.product_option_values pov
  on pov.axis_id = a.id
 and lower(pov.value) = lower(oe.option_value)
on conflict (variant_id, axis_id) do update set
  value_id = excluded.value_id;

update public.products p
set
  price_cents = rollup.min_price_cents,
  inventory_qty = rollup.total_inventory_qty,
  updated_at = now()
from (
  select
    product_id,
    min(price_cents) filter (where status = 'active') as min_price_cents,
    sum(inventory_qty) filter (where status = 'active') as total_inventory_qty
  from public.product_variants
  where store_id = '22222222-2222-4222-8222-222222222222'
  group by product_id
) rollup
where p.id = rollup.product_id;

insert into public.promotions (
  id,
  store_id,
  code,
  discount_type,
  discount_value,
  min_subtotal_cents,
  max_redemptions,
  per_customer_redemption_limit,
  times_redeemed,
  starts_at,
  ends_at,
  is_active,
  is_stackable,
  created_at
)
values
  ('44444444-4444-4444-8444-444444444441','22222222-2222-4222-8222-222222222222','WELCOME10','percent',10,3500,500,1,1,now() - interval '45 days',now() + interval '45 days',true,false,now() - interval '45 days'),
  ('44444444-4444-4444-8444-444444444442','22222222-2222-4222-8222-222222222222','BLOOM15','fixed',1500,8500,150,2,1,now() - interval '14 days',now() + interval '21 days',true,true,now() - interval '14 days'),
  ('44444444-4444-4444-8444-444444444443','22222222-2222-4222-8222-222222222222','FREESHIP75','free_shipping',0,7500,250,1,0,now() - interval '5 days',now() + interval '60 days',true,true,now() - interval '5 days'),
  ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','PICKUPPERK','percent',5,2500,300,3,0,now() - interval '30 days',now() + interval '90 days',true,true,now() - interval '30 days')
on conflict (store_id, code) do update set
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  min_subtotal_cents = excluded.min_subtotal_cents,
  max_redemptions = excluded.max_redemptions,
  per_customer_redemption_limit = excluded.per_customer_redemption_limit,
  times_redeemed = excluded.times_redeemed,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  is_active = excluded.is_active,
  is_stackable = excluded.is_stackable,
  updated_at = now();

update public.store_settings
set welcome_popup_promotion_id = '44444444-4444-4444-8444-444444444441'
where store_id = '22222222-2222-4222-8222-222222222222';

insert into public.store_content_blocks (id, store_id, sort_order, eyebrow, title, body, cta_label, cta_url, is_active)
values
  ('55555555-5555-4555-8555-555555555551','22222222-2222-4222-8222-222222222222',0,'Fresh this week','Peonies, sunflowers, and easy-care orchids','Margie updates the bench every Tuesday morning with what arrived strong, open, and gift-ready.','Shop the fresh bench','/s/margies-flower-shop/products',true),
  ('55555555-5555-4555-8555-555555555552','22222222-2222-4222-8222-222222222222',1,'Pickup friendly','Order before lunch, pick up after work','Local customers can reserve arrangements online and pick them up from the design bench without waiting in the shop line.','Choose pickup','/s/margies-flower-shop/cart',true),
  ('55555555-5555-4555-8555-555555555553','22222222-2222-4222-8222-222222222222',2,'Get excessive','Add chocolate, a care kit, or a second tiny vase','The best flower orders have a little flourish. Margie keeps add-ons practical, sweet, and easy to bundle.','Build a gift','/s/margies-flower-shop/products/date-night-flowers-chocolate',true)
on conflict (id) do update set
  sort_order = excluded.sort_order,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  body = excluded.body,
  cta_label = excluded.cta_label,
  cta_url = excluded.cta_url,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.customer_profiles (user_id, first_name, last_name, phone, default_shipping_address_json, preferences_json)
values
  ('33333333-3333-4333-8333-333333333331','Olivia','Chen','555-0101','{"line1":"22 Birch Street","city":"Maplewood","state":"NJ","postalCode":"07040","country":"US"}'::jsonb,'{"favoriteColors":["red","pink"],"occasions":["anniversary","birthday"]}'::jsonb),
  ('33333333-3333-4333-8333-333333333332','Nate','Rivera','555-0102','{"line1":"9 Valley Road","city":"South Orange","state":"NJ","postalCode":"07079","country":"US"}'::jsonb,'{"prefersPickup":true,"favoriteProductSku":"MG-ORCHID-BOWL"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333','Priya','Shah','555-0103','{"line1":"140 Ridgewood Ave","city":"Glen Ridge","state":"NJ","postalCode":"07028","country":"US"}'::jsonb,'{"favoriteColors":["yellow","orange"],"events":["brunch","showers"]}'::jsonb),
  ('33333333-3333-4333-8333-333333333334','Sasha','Reed','555-0104','{"line1":"74 Oakview Place","city":"Montclair","state":"NJ","postalCode":"07042","country":"US"}'::jsonb,'{"giftNotes":"Always include a card."}'::jsonb),
  ('33333333-3333-4333-8333-333333333335','Amanda','Lee','555-0105','{"line1":"3 Prospect Terrace","city":"Millburn","state":"NJ","postalCode":"07041","country":"US"}'::jsonb,'{"occasions":["sympathy","thank you"]}'::jsonb),
  ('33333333-3333-4333-8333-333333333336','Mateo','Garcia','555-0106','{"line1":"88 Elm Court","city":"Maplewood","state":"NJ","postalCode":"07040","country":"US"}'::jsonb,'{"newsletter":"weekly","plantCareLevel":"beginner"}'::jsonb)
on conflict (user_id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = excluded.phone,
  default_shipping_address_json = excluded.default_shipping_address_json,
  preferences_json = excluded.preferences_json,
  updated_at = now();

insert into public.customer_saved_stores (user_id, store_id)
values
  ('33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333332','22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333336','22222222-2222-4222-8222-222222222222')
on conflict (user_id, store_id) do nothing;

insert into public.customer_saved_items (user_id, store_id, product_id, product_variant_id, metadata_json)
select s.user_id::uuid, '22222222-2222-4222-8222-222222222222', p.id, pv.id, s.metadata_json
from (
  values
    ('33333333-3333-4333-8333-333333333331','MG-ROSE-BUILDER','MG-ROSE-PINK-24','{"list":"anniversary ideas"}'::jsonb),
    ('33333333-3333-4333-8333-333333333332','MG-ORCHID-BOWL','MG-ORCHID-CHARCOAL','{"list":"plant corner"}'::jsonb),
    ('33333333-3333-4333-8333-333333333333','MG-SUNLIT','MG-SUNLIT-GRAND','{"list":"brunch flowers"}'::jsonb),
    ('33333333-3333-4333-8333-333333333336','MG-WORKSHOP','MG-WORKSHOP-JUN06','{"list":"classes"}'::jsonb)
) as s(user_id, product_sku, variant_sku, metadata_json)
join public.products p on p.store_id = '22222222-2222-4222-8222-222222222222' and p.sku = s.product_sku
join public.product_variants pv on pv.store_id = p.store_id and pv.sku = s.variant_sku
on conflict (user_id, store_id, product_id, product_variant_id) do update set
  metadata_json = excluded.metadata_json;

insert into public.store_email_subscribers (store_id, email, status, source, subscribed_at, unsubscribed_at, metadata_json, created_at)
values
  ('22222222-2222-4222-8222-222222222222','olivia.chen@example.com','subscribed','checkout_opt_in',now() - interval '36 days',null,'{"interests":["roses","holiday windows"]}'::jsonb,now() - interval '36 days'),
  ('22222222-2222-4222-8222-222222222222','nate.rivera@example.com','subscribed','storefront_popup',now() - interval '30 days',null,'{"interests":["plants","pickup reminders"]}'::jsonb,now() - interval '30 days'),
  ('22222222-2222-4222-8222-222222222222','priya.shah@example.com','subscribed','checkout_opt_in',now() - interval '24 days',null,'{"interests":["event flowers"]}'::jsonb,now() - interval '24 days'),
  ('22222222-2222-4222-8222-222222222222','sasha.reed@example.com','subscribed','welcome_popup',now() - interval '18 days',null,'{"interests":["date night","chocolate"]}'::jsonb,now() - interval '18 days'),
  ('22222222-2222-4222-8222-222222222222','mateo.garcia@example.com','subscribed','manual_import',now() - interval '12 days',null,'{"interests":["workshops","plant care"]}'::jsonb,now() - interval '12 days'),
  ('22222222-2222-4222-8222-222222222222','jamie.wells@example.com','unsubscribed','storefront_footer',now() - interval '50 days',now() - interval '9 days','{"reason":"seasonal only"}'::jsonb,now() - interval '50 days')
on conflict (store_id, lower(email)) do update set
  status = excluded.status,
  source = excluded.source,
  subscribed_at = excluded.subscribed_at,
  unsubscribed_at = excluded.unsubscribed_at,
  metadata_json = excluded.metadata_json,
  updated_at = now();

insert into public.orders (
  id,
  store_id,
  customer_first_name,
  customer_last_name,
  customer_phone,
  customer_email,
  customer_note,
  shipping_address_json,
  fulfillment_method,
  fulfillment_label,
  shipping_fee_cents,
  currency,
  subtotal_cents,
  total_cents,
  status,
  fulfillment_status,
  fulfilled_at,
  shipped_at,
  delivered_at,
  stripe_payment_intent_id,
  carrier,
  tracking_number,
  tracking_url,
  shipment_provider,
  shipment_tracker_id,
  shipment_status,
  last_tracking_sync_at,
  discount_cents,
  promo_code,
  created_at,
  updated_at
)
values
  ('66666666-6666-4666-8666-666666666661','22222222-2222-4222-8222-222222222222','Olivia','Chen','555-0101','olivia.chen@example.com','Card: Still choosing you. Please keep the roses red.','{"line1":"22 Birch Street","city":"Maplewood","state":"NJ","postalCode":"07040","country":"US"}'::jsonb,'shipping','Local delivery',995,'usd',11600,11095,'paid','delivered',now() - interval '28 days',now() - interval '28 days',now() - interval '27 days','pi_margies_olivia_001','Margie Courier','MGD-1001','https://tracking.example/MGD-1001','manual','trk_margies_1001','delivered',now() - interval '27 days',1500,'BLOOM15',now() - interval '29 days',now() - interval '27 days'),
  ('66666666-6666-4666-8666-666666666662','22222222-2222-4222-8222-222222222222','Nate','Rivera','555-0102','nate.rivera@example.com','Please hold at the counter. I will pick up after 4 PM.',null,'pickup','Pickup at Margie''s design bench',0,'usd',7600,7600,'paid','delivered',now() - interval '23 days',null,now() - interval '23 days','pi_margies_nate_001',null,null,null,null,null,null,null,0,null,now() - interval '24 days',now() - interval '23 days'),
  ('66666666-6666-4666-8666-666666666663','22222222-2222-4222-8222-222222222222','Priya','Shah','555-0103','priya.shah@example.com','Brunch centerpiece. Warm colors please.','{"line1":"140 Ridgewood Ave","city":"Glen Ridge","state":"NJ","postalCode":"07028","country":"US"}'::jsonb,'shipping','Local delivery',995,'usd',11600,12595,'paid','shipped',now() - interval '8 days',now() - interval '8 days',null,'pi_margies_priya_001','Margie Courier','MGD-1003','https://tracking.example/MGD-1003','manual','trk_margies_1003','out_for_delivery',now() - interval '8 days',0,null,now() - interval '9 days',now() - interval '8 days'),
  ('66666666-6666-4666-8666-666666666664','22222222-2222-4222-8222-222222222222','Sasha','Reed','555-0104','sasha.reed@example.com','Please tuck the card under the ribbon.','{"line1":"74 Oakview Place","city":"Montclair","state":"NJ","postalCode":"07042","country":"US"}'::jsonb,'shipping','Local delivery',0,'usd',9800,8820,'paid','delivered',now() - interval '16 days',now() - interval '16 days',now() - interval '16 days','pi_margies_sasha_001','Margie Courier','MGD-1004','https://tracking.example/MGD-1004','manual','trk_margies_1004','delivered',now() - interval '16 days',980,'WELCOME10',now() - interval '17 days',now() - interval '16 days'),
  ('66666666-6666-4666-8666-666666666665','22222222-2222-4222-8222-222222222222','Amanda','Lee','555-0105','amanda.lee@example.com','Sympathy card message is in the order note. Neutral ribbon if possible.','{"line1":"3 Prospect Terrace","city":"Millburn","state":"NJ","postalCode":"07041","country":"US"}'::jsonb,'shipping','Regional shipping',995,'usd',5800,6795,'paid','packing',null,null,null,'pi_margies_amanda_001',null,null,null,null,null,null,null,0,null,now() - interval '3 days',now() - interval '1 days'),
  ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','Mateo','Garcia','555-0106','mateo.garcia@example.com','Moody palette, no lilies please.','{"line1":"88 Elm Court","city":"Maplewood","state":"NJ","postalCode":"07040","country":"US"}'::jsonb,'shipping','Local delivery',995,'usd',9600,10595,'paid','pending_fulfillment',null,null,null,'pi_margies_mateo_001',null,null,null,null,null,null,null,0,null,now() - interval '1 days',now() - interval '1 days'),
  ('66666666-6666-4666-8666-666666666667','22222222-2222-4222-8222-222222222222','Evelyn','Brooks','555-0107','evelyn.brooks@example.com','Three small vases for a dinner party. Mixed palette.',null,'pickup','Pickup at Margie''s design bench',0,'usd',8400,8400,'paid','pending_fulfillment',null,null,null,'pi_margies_evelyn_001',null,null,null,null,null,null,null,0,null,now() - interval '10 hours',now() - interval '10 hours'),
  ('66666666-6666-4666-8666-666666666668','22222222-2222-4222-8222-222222222222','Jordan','Kim','555-0108','jordan.kim@example.com','Two workshop seats next to each other if that matters.',null,'pickup','In-shop workshop seat',0,'usd',13000,13000,'paid','pending_fulfillment',null,null,null,'pi_margies_jordan_001',null,null,null,null,null,null,null,0,null,now() - interval '6 hours',now() - interval '6 hours')
on conflict (id) do update set
  customer_first_name = excluded.customer_first_name,
  customer_last_name = excluded.customer_last_name,
  customer_phone = excluded.customer_phone,
  customer_email = excluded.customer_email,
  customer_note = excluded.customer_note,
  shipping_address_json = excluded.shipping_address_json,
  fulfillment_method = excluded.fulfillment_method,
  fulfillment_label = excluded.fulfillment_label,
  shipping_fee_cents = excluded.shipping_fee_cents,
  subtotal_cents = excluded.subtotal_cents,
  total_cents = excluded.total_cents,
  status = excluded.status,
  fulfillment_status = excluded.fulfillment_status,
  fulfilled_at = excluded.fulfilled_at,
  shipped_at = excluded.shipped_at,
  delivered_at = excluded.delivered_at,
  stripe_payment_intent_id = excluded.stripe_payment_intent_id,
  carrier = excluded.carrier,
  tracking_number = excluded.tracking_number,
  tracking_url = excluded.tracking_url,
  shipment_provider = excluded.shipment_provider,
  shipment_tracker_id = excluded.shipment_tracker_id,
  shipment_status = excluded.shipment_status,
  last_tracking_sync_at = excluded.last_tracking_sync_at,
  discount_cents = excluded.discount_cents,
  promo_code = excluded.promo_code,
  updated_at = excluded.updated_at;

update public.orders
set
  pickup_location_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  pickup_location_snapshot_json = '{"name":"Margie''s design bench","addressLine1":"18 Rosewater Lane","addressLine2":"Suite B","city":"Maplewood","stateRegion":"NJ","postalCode":"07040","countryCode":"US"}'::jsonb,
  pickup_window_start_at = case
    when id = '66666666-6666-4666-8666-666666666662' then now() - interval '23 days'
    when id = '66666666-6666-4666-8666-666666666667' then now() + interval '1 days'
    when id = '66666666-6666-4666-8666-666666666668' then timestamp with time zone '2026-05-23 10:00:00-04'
    else pickup_window_start_at
  end,
  pickup_window_end_at = case
    when id = '66666666-6666-4666-8666-666666666662' then now() - interval '23 days' + interval '30 minutes'
    when id = '66666666-6666-4666-8666-666666666667' then now() + interval '1 days 30 minutes'
    when id = '66666666-6666-4666-8666-666666666668' then timestamp with time zone '2026-05-23 12:00:00-04'
    else pickup_window_end_at
  end,
  pickup_timezone = 'America/New_York'
where store_id = '22222222-2222-4222-8222-222222222222'
  and fulfillment_method = 'pickup';

insert into public.order_items (order_id, product_id, product_variant_id, quantity, unit_price_cents, variant_label, variant_snapshot)
select
  lines.order_id::uuid,
  p.id,
  pv.id,
  lines.quantity,
  lines.unit_price_cents,
  lines.variant_label,
  jsonb_build_object('sku', pv.sku, 'title', pv.title, 'optionValues', pv.option_values, 'priceCents', lines.unit_price_cents)
from (
  values
    ('66666666-6666-4666-8666-666666666661','MG-ROSE-RED-24',1,8800,'24 red roses'),
    ('66666666-6666-4666-8666-666666666661','MG-TRUFFLES-12',1,2800,'12-piece box'),
    ('66666666-6666-4666-8666-666666666662','MG-ORCHID-WHITE',1,7600,'White ceramic bowl'),
    ('66666666-6666-4666-8666-666666666663','MG-SUNLIT-GRAND',1,9800,'Grand'),
    ('66666666-6666-4666-8666-666666666663','MG-CARE-KIT-STD',1,1800,'Care kit'),
    ('66666666-6666-4666-8666-666666666664','MG-DATE-ROSE',1,9800,'Red roses bundle'),
    ('66666666-6666-4666-8666-666666666665','MG-PEACE-LILY-STD',1,5800,'Ribboned plant'),
    ('66666666-6666-4666-8666-666666666666','MG-DESIGNER-MOODY',1,7200,'Moody and romantic'),
    ('66666666-6666-4666-8666-666666666666','MG-LAVENDER-STD',1,2400,'Ribbon-tied bundle'),
    ('66666666-6666-4666-8666-666666666667','MG-BUD-MIXED',1,3900,'Mixed trio'),
    ('66666666-6666-4666-8666-666666666667','MG-TRUFFLES-24',1,4800,'24-piece box'),
    ('66666666-6666-4666-8666-666666666668','MG-WORKSHOP-MAY23',2,6500,'May 23 workshop')
) as lines(order_id, variant_sku, quantity, unit_price_cents, variant_label)
join public.product_variants pv on pv.store_id = '22222222-2222-4222-8222-222222222222' and pv.sku = lines.variant_sku
join public.products p on p.id = pv.product_id
where not exists (
  select 1
  from public.order_items existing
  where existing.order_id = lines.order_id::uuid
    and existing.product_variant_id = pv.id
);

insert into public.promotion_redemptions (store_id, promotion_id, order_id, customer_user_id, customer_email_normalized, created_at)
values
  ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444442','66666666-6666-4666-8666-666666666661','33333333-3333-4333-8333-333333333331','olivia.chen@example.com',now() - interval '29 days'),
  ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444441','66666666-6666-4666-8666-666666666664','33333333-3333-4333-8333-333333333334','sasha.reed@example.com',now() - interval '17 days')
on conflict (order_id, promotion_id) do update set
  customer_user_id = excluded.customer_user_id,
  customer_email_normalized = excluded.customer_email_normalized;

insert into public.inventory_movements (store_id, product_id, product_variant_id, order_id, delta_qty, reason, note, created_at)
select '22222222-2222-4222-8222-222222222222', p.id, pv.id, null, restock.delta_qty, 'restock', restock.note, now() - interval '34 days'
from (
  values
    ('MG-ROSE-RED-12',24,'Opening cooler count'),
    ('MG-ROSE-RED-24',12,'Opening cooler count'),
    ('MG-SUNLIT-SIGNATURE',16,'Market restock'),
    ('MG-ORCHID-WHITE',8,'Plant delivery'),
    ('MG-TRUFFLES-12',24,'Chocolatier delivery')
) as restock(variant_sku, delta_qty, note)
join public.product_variants pv on pv.store_id = '22222222-2222-4222-8222-222222222222' and pv.sku = restock.variant_sku
join public.products p on p.id = pv.product_id
where not exists (
  select 1 from public.inventory_movements im
  where im.product_variant_id = pv.id
    and im.reason = 'restock'
    and im.note = restock.note
);

insert into public.inventory_movements (store_id, product_id, product_variant_id, order_id, delta_qty, reason, note, created_at)
select o.store_id, oi.product_id, oi.product_variant_id, oi.order_id, -oi.quantity, 'sale', 'Seeded demo order sale', o.created_at
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.store_id = '22222222-2222-4222-8222-222222222222'
  and not exists (
    select 1 from public.inventory_movements im
    where im.order_id = oi.order_id
      and im.product_variant_id = oi.product_variant_id
      and im.reason = 'sale'
  );

insert into public.customer_carts (id, user_id, store_id, status, metadata_json, created_at, updated_at)
values
  ('77777777-7777-4777-8777-777777777771','33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222','active','{"source":"saved for anniversary","couponCandidate":"FREESHIP75"}'::jsonb,now() - interval '2 days',now() - interval '1 hours'),
  ('77777777-7777-4777-8777-777777777772','33333333-3333-4333-8333-333333333336','22222222-2222-4222-8222-222222222222','abandoned','{"source":"workshop browse","lastStep":"cart"}'::jsonb,now() - interval '5 days',now() - interval '4 days'),
  ('77777777-7777-4777-8777-777777777773','33333333-3333-4333-8333-333333333334','22222222-2222-4222-8222-222222222222','ordered','{"convertedOrderId":"66666666-6666-4666-8666-666666666664"}'::jsonb,now() - interval '18 days',now() - interval '17 days')
on conflict (id) do update set
  status = excluded.status,
  metadata_json = excluded.metadata_json,
  updated_at = excluded.updated_at;

insert into public.customer_cart_items (cart_id, product_id, product_variant_id, quantity, unit_price_snapshot_cents, metadata_json)
select c.cart_id::uuid, p.id, pv.id, c.quantity, c.unit_price_snapshot_cents, c.metadata_json
from (
  values
    ('77777777-7777-4777-8777-777777777771','MG-ROSE-PINK-24',1,8800,'{"gift":"anniversary"}'::jsonb),
    ('77777777-7777-4777-8777-777777777771','MG-TRUFFLES-12',1,2800,'{"addOn":true}'::jsonb),
    ('77777777-7777-4777-8777-777777777772','MG-WORKSHOP-JUN06',1,6500,'{"maybeLater":true}'::jsonb),
    ('77777777-7777-4777-8777-777777777773','MG-DATE-ROSE',1,9800,'{"converted":true}'::jsonb)
) as c(cart_id, variant_sku, quantity, unit_price_snapshot_cents, metadata_json)
join public.product_variants pv on pv.store_id = '22222222-2222-4222-8222-222222222222' and pv.sku = c.variant_sku
join public.products p on p.id = pv.product_id
on conflict (cart_id, product_id, product_variant_id) do update set
  quantity = excluded.quantity,
  unit_price_snapshot_cents = excluded.unit_price_snapshot_cents,
  metadata_json = excluded.metadata_json,
  updated_at = now();

insert into public.back_in_stock_alerts (
  store_id,
  product_id,
  product_variant_id,
  email,
  status,
  source,
  alert_count,
  requested_at,
  sent_at,
  last_alert_sent_at,
  metadata_json,
  created_at
)
select '22222222-2222-4222-8222-222222222222', p.id, pv.id, a.email, a.status, a.source, a.alert_count, a.requested_at, a.sent_at, a.last_alert_sent_at, a.metadata_json, a.requested_at
from (
  values
    ('MG-ROSE-WHITE-36','olivia.chen@example.com','pending','storefront_product_detail',0,now() - interval '5 days',null::timestamptz,null::timestamptz,'{"occasion":"wedding shower"}'::jsonb),
    ('MG-ORCHID-CHARCOAL','nate.rivera@example.com','pending','storefront_product_detail',0,now() - interval '4 days',null::timestamptz,null::timestamptz,'{"preferredPickup":"Friday"}'::jsonb),
    ('MG-TRUFFLES-24','evelyn.brooks@example.com','pending','cart_cross_sell',0,now() - interval '2 days',null::timestamptz,null::timestamptz,'{"cartId":"77777777-7777-4777-8777-777777777771"}'::jsonb),
    ('MG-WORKSHOP-MAY23','mateo.garcia@example.com','sent','storefront_product_detail',1,now() - interval '10 days',now() - interval '7 days',now() - interval '7 days','{"message":"May workshop seats briefly reopened."}'::jsonb)
) as a(variant_sku,email,status,source,alert_count,requested_at,sent_at,last_alert_sent_at,metadata_json)
join public.product_variants pv on pv.store_id = '22222222-2222-4222-8222-222222222222' and pv.sku = a.variant_sku
join public.products p on p.id = pv.product_id
on conflict (store_id, product_variant_id, lower(email)) do update set
  status = excluded.status,
  source = excluded.source,
  alert_count = excluded.alert_count,
  requested_at = excluded.requested_at,
  sent_at = excluded.sent_at,
  last_alert_sent_at = excluded.last_alert_sent_at,
  metadata_json = excluded.metadata_json,
  updated_at = now();

insert into public.reviews (
  id,
  store_id,
  product_id,
  order_id,
  review_type,
  reviewer_user_id,
  reviewer_email,
  reviewer_name,
  rating,
  title,
  body,
  verified_purchase,
  status,
  metadata,
  published_at,
  created_at
)
select r.id::uuid, '22222222-2222-4222-8222-222222222222', p.id, r.order_id::uuid, 'product', r.user_id::uuid, r.email, r.name, r.rating, r.title, r.body, true, 'published', r.metadata, r.created_at + interval '2 hours', r.created_at
from (
  values
    ('88888888-8888-4888-8888-888888888801','MG-ROSE-BUILDER','66666666-6666-4666-8666-666666666661','33333333-3333-4333-8333-333333333331','olivia.chen@example.com','Olivia C.',5,'The roses opened beautifully','The 24-stem red bouquet looked classic without feeling generic. It lasted almost a full week and the card was tucked in exactly where I asked.','{"source":"post_delivery_email","sentiment":"delighted"}'::jsonb,now() - interval '26 days'),
    ('88888888-8888-4888-8888-888888888802','MG-TRUFFLES','66666666-6666-4666-8666-666666666661','33333333-3333-4333-8333-333333333331','olivia.chen@example.com','Olivia C.',5,'Add the chocolate','The truffles made the gift feel finished. I bought them as an add-on and would absolutely do it again.','{"source":"post_delivery_email","sentiment":"delighted"}'::jsonb,now() - interval '26 days'),
    ('88888888-8888-4888-8888-888888888803','MG-ORCHID-BOWL','66666666-6666-4666-8666-666666666662','33333333-3333-4333-8333-333333333332','nate.rivera@example.com','Nate R.',5,'A very calm plant','The orchid was ready at pickup and looked more expensive than it was. The care card helped because I am not an orchid person yet.','{"source":"pickup_followup","sentiment":"confident"}'::jsonb,now() - interval '22 days'),
    ('88888888-8888-4888-8888-888888888804','MG-SUNLIT','66666666-6666-4666-8666-666666666663','33333333-3333-4333-8333-333333333333','priya.shah@example.com','Priya S.',5,'Brunch table hero','The grand size was full enough for a long table and the sunflower mix photographed beautifully in morning light.','{"source":"post_delivery_email","sentiment":"delighted","occasion":"brunch"}'::jsonb,now() - interval '7 days'),
    ('88888888-8888-4888-8888-888888888805','MG-CARE-KIT','66666666-6666-4666-8666-666666666663','33333333-3333-4333-8333-333333333333','priya.shah@example.com','Priya S.',4,'Useful little add-on','The packet and stem trimmer made it easy to refresh the bouquet after the party. Not glamorous, but genuinely useful.','{"source":"post_delivery_email","sentiment":"positive"}'::jsonb,now() - interval '7 days'),
    ('88888888-8888-4888-8888-888888888806','MG-DATE-NIGHT','66666666-6666-4666-8666-666666666664','33333333-3333-4333-8333-333333333334','sasha.reed@example.com','Sasha R.',5,'Exactly the right amount of extra','The flowers and chocolate bundle was polished without being stiff. Delivery was quiet, which mattered for the surprise.','{"source":"post_delivery_email","sentiment":"delighted"}'::jsonb,now() - interval '15 days'),
    ('88888888-8888-4888-8888-888888888807','MG-PEACE-LILY','66666666-6666-4666-8666-666666666665','33333333-3333-4333-8333-333333333335','amanda.lee@example.com','Amanda L.',5,'Gentle and appropriate','The peace lily felt respectful and not overdone. Margie helped adjust the ribbon color for the occasion.','{"source":"support_followup","sentiment":"grateful"}'::jsonb,now() - interval '2 days'),
    ('88888888-8888-4888-8888-888888888808','MG-DESIGNER-CHOICE','66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333336','mateo.garcia@example.com','Mateo G.',4,'Great palette, tiny delay','The moody arrangement was gorgeous. It was delayed by a morning cooler issue, but the shop texted before I had to ask.','{"source":"dashboard_seed","sentiment":"positive_with_note"}'::jsonb,now() - interval '12 hours')
) as r(id, product_sku, order_id, user_id, email, name, rating, title, body, metadata, created_at)
join public.products p on p.store_id = '22222222-2222-4222-8222-222222222222' and p.sku = r.product_sku
on conflict (store_id, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(order_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(reviewer_email)) do update set
  rating = excluded.rating,
  title = excluded.title,
  body = excluded.body,
  verified_purchase = excluded.verified_purchase,
  status = excluded.status,
  metadata = excluded.metadata,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.reviews (
  id,
  store_id,
  product_id,
  order_id,
  review_type,
  reviewer_user_id,
  reviewer_email,
  reviewer_name,
  rating,
  title,
  body,
  verified_purchase,
  status,
  metadata,
  published_at,
  created_at
)
values
  ('88888888-8888-4888-8888-888888888851','22222222-2222-4222-8222-222222222222',null,'66666666-6666-4666-8666-666666666661','store','33333333-3333-4333-8333-333333333331','olivia.chen@example.com','Olivia C.',5,'My go-to flower shop now','The checkout note actually made it to the designer, which is such a relief for gift orders.',true,'published','{"source":"post_delivery_email"}'::jsonb,now() - interval '26 days',now() - interval '26 days'),
  ('88888888-8888-4888-8888-888888888852','22222222-2222-4222-8222-222222222222',null,'66666666-6666-4666-8666-666666666662','store','33333333-3333-4333-8333-333333333332','nate.rivera@example.com','Nate R.',5,'Pickup was seamless','I was in and out in two minutes and the arrangement was already labeled with my name.',true,'published','{"source":"pickup_followup"}'::jsonb,now() - interval '22 days',now() - interval '22 days'),
  ('88888888-8888-4888-8888-888888888853','22222222-2222-4222-8222-222222222222',null,'66666666-6666-4666-8666-666666666663','store','33333333-3333-4333-8333-333333333333','priya.shah@example.com','Priya S.',5,'The details are handled','The order page, delivery tracking, and care instructions were all clear. The flowers were the fun part.',true,'published','{"source":"post_delivery_email"}'::jsonb,now() - interval '7 days',now() - interval '7 days'),
  ('88888888-8888-4888-8888-888888888854','22222222-2222-4222-8222-222222222222',null,'66666666-6666-4666-8666-666666666664','store','33333333-3333-4333-8333-333333333334','sasha.reed@example.com','Sasha R.',5,'Warm, fast, and human','The site was easy, but it still felt like ordering from an actual neighborhood shop.',true,'published','{"source":"post_delivery_email"}'::jsonb,now() - interval '15 days',now() - interval '15 days'),
  ('88888888-8888-4888-8888-888888888855','22222222-2222-4222-8222-222222222222',null,null,'store',null,'jamie.wells@example.com','Jamie W.',4,'Lovely storefront','I used the newsletter signup for holiday reminders. The photos and descriptions make it easy to choose without overthinking.',false,'published','{"source":"storefront_form"}'::jsonb,now() - interval '11 days',now() - interval '11 days'),
  ('88888888-8888-4888-8888-888888888856','22222222-2222-4222-8222-222222222222',null,null,'store',null,'taylor.morgan@example.com','Taylor M.',5,'Great local find','The shop alert about low-stock roses was helpful. I grabbed another bouquet before the weekend rush.',false,'published','{"source":"storefront_form"}'::jsonb,now() - interval '4 days',now() - interval '4 days')
on conflict (store_id, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(order_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(reviewer_email)) do update set
  rating = excluded.rating,
  title = excluded.title,
  body = excluded.body,
  verified_purchase = excluded.verified_purchase,
  status = excluded.status,
  metadata = excluded.metadata,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.review_media (
  id,
  review_id,
  storage_path,
  public_url,
  mime_type,
  size_bytes,
  width,
  height,
  sort_order,
  status,
  metadata
)
values
  ('99999999-9999-4999-8999-999999999901','88888888-8888-4888-8888-888888888801','demo/margies/reviews/rose-builder-red.jpg','https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200','image/jpeg',512000,1200,1600,0,'active','{"caption":"Customer-style rose bouquet photo","source":"pexels"}'::jsonb),
  ('99999999-9999-4999-8999-999999999902','88888888-8888-4888-8888-888888888803','demo/margies/reviews/orchid-bowl.jpg','https://images.pexels.com/photos/28611132/pexels-photo-28611132.jpeg?auto=compress&cs=tinysrgb&w=1200','image/jpeg',640000,1200,1800,0,'active','{"caption":"Potted plant display reference","source":"pexels"}'::jsonb),
  ('99999999-9999-4999-8999-999999999903','88888888-8888-4888-8888-888888888804','demo/margies/reviews/sunlit-market.jpg','https://images.pexels.com/photos/19938156/pexels-photo-19938156.jpeg?auto=compress&cs=tinysrgb&w=1200','image/jpeg',588000,1200,800,0,'active','{"caption":"Bright market bouquet reference","source":"pexels"}'::jsonb),
  ('99999999-9999-4999-8999-999999999904','88888888-8888-4888-8888-888888888806','demo/margies/reviews/date-night-chocolate.jpg','https://images.pexels.com/photos/13831901/pexels-photo-13831901.jpeg?auto=compress&cs=tinysrgb&w=1200','image/jpeg',512000,1200,1600,0,'active','{"caption":"Flowers and chocolate bundle reference","source":"pexels"}'::jsonb),
  ('99999999-9999-4999-8999-999999999905','88888888-8888-4888-8888-888888888851','demo/margies/reviews/shop-display.jpg','https://images.pexels.com/photos/16160332/pexels-photo-16160332.jpeg?auto=compress&cs=tinysrgb&w=1200','image/jpeg',533000,1200,800,0,'active','{"caption":"Florist display reference","source":"pexels"}'::jsonb)
on conflict (id) do update set
  public_url = excluded.public_url,
  mime_type = excluded.mime_type,
  size_bytes = excluded.size_bytes,
  width = excluded.width,
  height = excluded.height,
  sort_order = excluded.sort_order,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.review_responses (id, review_id, store_id, author_user_id, body, metadata, created_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','88888888-8888-4888-8888-888888888801','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Thank you, Olivia. We remember that card placement request and are so glad the roses opened well.', '{"tone":"warm","seeded":true}'::jsonb, now() - interval '25 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','88888888-8888-4888-8888-888888888803','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Nate, welcome to orchid personhood. Keep it in bright indirect light and ignore it more than you think.', '{"tone":"helpful","seeded":true}'::jsonb, now() - interval '21 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','88888888-8888-4888-8888-888888888808','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111112','Thank you for the patience, Mateo. We added a note to avoid lilies on future designer-choice orders.', '{"tone":"service_recovery","seeded":true}'::jsonb, now() - interval '6 hours')
on conflict (review_id) do update set
  author_user_id = excluded.author_user_id,
  body = excluded.body,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.review_aggregate_snapshots (
  store_id,
  product_id,
  review_count,
  average_rating,
  rating_1_count,
  rating_2_count,
  rating_3_count,
  rating_4_count,
  rating_5_count,
  updated_at
)
select
  store_id,
  product_id,
  count(*)::integer,
  round(avg(rating)::numeric, 2),
  count(*) filter (where rating = 1)::integer,
  count(*) filter (where rating = 2)::integer,
  count(*) filter (where rating = 3)::integer,
  count(*) filter (where rating = 4)::integer,
  count(*) filter (where rating = 5)::integer,
  now()
from public.reviews
where store_id = '22222222-2222-4222-8222-222222222222'
  and product_id is not null
  and status = 'published'
group by store_id, product_id
on conflict (store_id, product_id) do update set
  review_count = excluded.review_count,
  average_rating = excluded.average_rating,
  rating_1_count = excluded.rating_1_count,
  rating_2_count = excluded.rating_2_count,
  rating_3_count = excluded.rating_3_count,
  rating_4_count = excluded.rating_4_count,
  rating_5_count = excluded.rating_5_count,
  updated_at = now();
