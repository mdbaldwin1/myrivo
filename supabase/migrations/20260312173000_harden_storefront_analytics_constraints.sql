alter table public.storefront_events
  drop constraint if exists storefront_events_event_type_check;

alter table public.storefront_events
  add constraint storefront_events_event_type_check
  check (
    event_type in (
      'page_view',
      'product_view',
      'add_to_cart',
      'cart_view',
      'checkout_started',
      'checkout_completed',
      'newsletter_subscribed',
      'search_performed'
    )
  );

alter table public.storefront_events
  drop constraint if exists storefront_events_value_json_object_check;

alter table public.storefront_events
  add constraint storefront_events_value_json_object_check
  check (jsonb_typeof(value_json) = 'object');

alter table public.storefront_daily_rollups
  drop constraint if exists storefront_daily_rollups_nonnegative_check;

alter table public.storefront_daily_rollups
  add constraint storefront_daily_rollups_nonnegative_check
  check (
    visitors >= 0 and
    sessions >= 0 and
    pageviews >= 0 and
    product_views >= 0 and
    add_to_cart >= 0 and
    checkout_started >= 0 and
    checkout_completed >= 0 and
    revenue_cents >= 0
  );
