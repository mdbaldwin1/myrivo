alter table public.store_domains
  add column if not exists hosting_provider text not null default 'vercel'
    check (hosting_provider in ('vercel')),
  add column if not exists hosting_status text not null default 'pending'
    check (hosting_status in ('pending', 'provisioning', 'ready', 'failed', 'not_configured')),
  add column if not exists hosting_last_checked_at timestamptz,
  add column if not exists hosting_ready_at timestamptz,
  add column if not exists hosting_error text,
  add column if not exists hosting_metadata_json jsonb not null default '{}'::jsonb;
