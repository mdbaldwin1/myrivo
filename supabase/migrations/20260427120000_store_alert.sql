-- Add storefront alert popup fields. The alert is a customer-facing modal,
-- separate from the welcome popup, used for time-sensitive merchant messages
-- (e.g. fulfillment delays).
alter table store_settings
  add column if not exists store_alert_enabled boolean not null default false,
  add column if not exists store_alert_title text default null,
  add column if not exists store_alert_message text default null,
  add column if not exists store_alert_delay_seconds integer not null default 8,
  add column if not exists store_alert_dismiss_days integer not null default 7;
