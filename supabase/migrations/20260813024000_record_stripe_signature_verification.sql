alter table public.stripe_webhook_events
  add column if not exists signature_verified boolean not null default false;

comment on column public.stripe_webhook_events.signature_verified is
  'True only when the application constructed this event after Stripe webhook signature verification succeeded.';
