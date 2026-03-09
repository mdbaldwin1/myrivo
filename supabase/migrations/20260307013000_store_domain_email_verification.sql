alter table public.store_domains
  add column if not exists email_provider text not null default 'resend',
  add column if not exists email_status text not null default 'pending'
    check (email_status in ('pending', 'provisioning', 'ready', 'failed', 'not_configured')),
  add column if not exists email_domain_id text,
  add column if not exists email_last_checked_at timestamptz,
  add column if not exists email_ready_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_metadata_json jsonb not null default '{}'::jsonb;
