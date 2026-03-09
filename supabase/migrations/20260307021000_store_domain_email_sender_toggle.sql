alter table public.store_domains
  add column if not exists email_sender_enabled boolean not null default false;
