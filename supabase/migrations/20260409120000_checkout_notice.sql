-- Add checkout notice field for displaying messages on the checkout page
alter table store_settings add column if not exists checkout_notice text default null;
