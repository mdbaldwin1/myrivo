create table if not exists public.accessibility_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_name text,
  reporter_email text not null,
  page_url text,
  feature_area text not null,
  issue_summary text not null,
  expected_behavior text,
  actual_behavior text not null,
  assistive_technology text,
  browser text,
  device text,
  blocks_critical_flow boolean not null default false,
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'resolved', 'dismissed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  owner_notes text,
  remediation_notes text,
  source text not null default 'public_form' check (source in ('public_form', 'support', 'manual')),
  triaged_at timestamptz,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accessibility_reports_status_priority
  on public.accessibility_reports (status, priority, created_at desc);

create index if not exists idx_accessibility_reports_email_created_at
  on public.accessibility_reports (reporter_email, created_at desc);

drop trigger if exists accessibility_reports_set_updated_at on public.accessibility_reports;
create trigger accessibility_reports_set_updated_at
before update on public.accessibility_reports
for each row execute function public.set_updated_at();

alter table public.accessibility_reports enable row level security;
