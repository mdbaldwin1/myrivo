create table if not exists public.store_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  owner_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'generation_pending', 'generation_running', 'generation_failed', 'reveal_ready', 'completed', 'abandoned')),
  current_step text check (current_step in ('logo', 'describeStore', 'visualDirection', 'firstProduct', 'review')),
  last_completed_step text check (last_completed_step in ('logo', 'describeStore', 'visualDirection', 'firstProduct', 'review')),
  first_product_id uuid references public.products(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  last_seen_at timestamptz,
  generation_requested_at timestamptz,
  generation_completed_at timestamptz,
  generation_failed_at timestamptz,
  generation_error_code text,
  generation_error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_onboarding_answers (
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id uuid not null references public.store_onboarding_sessions(id) on delete cascade,
  answers_json jsonb not null default '{}'::jsonb,
  normalized_answers_json jsonb not null default '{}'::jsonb,
  step_progress_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (store_id, session_id)
);

create table if not exists public.store_onboarding_generation_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id uuid not null references public.store_onboarding_sessions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'partially_applied')),
  provider text,
  model text,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  applied_snapshot_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_store_onboarding_sessions_store_id on public.store_onboarding_sessions(store_id);
create index if not exists idx_store_onboarding_sessions_owner_user_id on public.store_onboarding_sessions(owner_user_id);
create index if not exists idx_store_onboarding_sessions_status on public.store_onboarding_sessions(status);
create index if not exists idx_store_onboarding_generation_runs_store_id on public.store_onboarding_generation_runs(store_id);
create index if not exists idx_store_onboarding_generation_runs_session_id on public.store_onboarding_generation_runs(session_id);
create index if not exists idx_store_onboarding_generation_runs_status on public.store_onboarding_generation_runs(status);

drop trigger if exists store_onboarding_sessions_set_updated_at on public.store_onboarding_sessions;
create trigger store_onboarding_sessions_set_updated_at
before update on public.store_onboarding_sessions
for each row execute function public.set_updated_at();

drop trigger if exists store_onboarding_answers_set_updated_at on public.store_onboarding_answers;
create trigger store_onboarding_answers_set_updated_at
before update on public.store_onboarding_answers
for each row execute function public.set_updated_at();

drop trigger if exists store_onboarding_generation_runs_set_updated_at on public.store_onboarding_generation_runs;
create trigger store_onboarding_generation_runs_set_updated_at
before update on public.store_onboarding_generation_runs
for each row execute function public.set_updated_at();

alter table public.store_onboarding_sessions enable row level security;
alter table public.store_onboarding_answers enable row level security;
alter table public.store_onboarding_generation_runs enable row level security;

drop policy if exists store_onboarding_sessions_owner_manage on public.store_onboarding_sessions;
create policy store_onboarding_sessions_owner_manage on public.store_onboarding_sessions
for all
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_onboarding_sessions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
)
with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_onboarding_sessions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
);

drop policy if exists store_onboarding_answers_owner_manage on public.store_onboarding_answers;
create policy store_onboarding_answers_owner_manage on public.store_onboarding_answers
for all
using (
  exists (
    select 1
    from public.store_onboarding_sessions sos
    where sos.id = store_onboarding_answers.session_id
      and (
        sos.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.store_memberships sm
          where sm.store_id = sos.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.store_onboarding_sessions sos
    where sos.id = store_onboarding_answers.session_id
      and (
        sos.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.store_memberships sm
          where sm.store_id = sos.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
      )
  )
);

drop policy if exists store_onboarding_generation_runs_owner_manage on public.store_onboarding_generation_runs;
create policy store_onboarding_generation_runs_owner_manage on public.store_onboarding_generation_runs
for all
using (
  exists (
    select 1
    from public.store_onboarding_sessions sos
    where sos.id = store_onboarding_generation_runs.session_id
      and (
        sos.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.store_memberships sm
          where sm.store_id = sos.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.store_onboarding_sessions sos
    where sos.id = store_onboarding_generation_runs.session_id
      and (
        sos.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.store_memberships sm
          where sm.store_id = sos.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
      )
  )
);
