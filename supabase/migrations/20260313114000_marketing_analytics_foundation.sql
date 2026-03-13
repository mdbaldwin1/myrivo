create table if not exists public.marketing_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  entry_path text,
  landing_page_key text,
  referrer text,
  referrer_host text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_term text,
  first_utm_content text,
  last_utm_source text,
  last_utm_medium text,
  last_utm_campaign text,
  last_utm_term text,
  last_utm_content text,
  experiment_assignments_json jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc'::text, now()),
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.marketing_sessions(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  path text,
  page_key text,
  section_key text,
  cta_key text,
  cta_label text,
  value_json jsonb not null default '{}'::jsonb,
  experiment_assignments_json jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_marketing_sessions_last_seen
  on public.marketing_sessions(last_seen_at desc);

create index if not exists idx_marketing_events_occurred
  on public.marketing_events(occurred_at desc);

create index if not exists idx_marketing_events_page_key
  on public.marketing_events(page_key, occurred_at desc);

create index if not exists idx_marketing_events_cta_key
  on public.marketing_events(cta_key, occurred_at desc);

alter table public.marketing_events
  drop constraint if exists marketing_events_event_type_check;

alter table public.marketing_events
  add constraint marketing_events_event_type_check
  check (
    event_type in (
      'page_view',
      'cta_click',
      'pricing_interaction',
      'signup_started',
      'signup_completed',
      'demo_request_started'
    )
  );

alter table public.marketing_events
  drop constraint if exists marketing_events_value_json_object_check;

alter table public.marketing_events
  add constraint marketing_events_value_json_object_check
  check (jsonb_typeof(value_json) = 'object');

alter table public.marketing_sessions
  enable row level security;

alter table public.marketing_events
  enable row level security;
