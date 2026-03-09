-- Ensure all stores always have a billing profile row.
with preferred_plan as (
  select id
  from public.billing_plans
  where key in ('standard', 'starter')
    and active = true
  order by case when key = 'standard' then 0 else 1 end
  limit 1
)
insert into public.store_billing_profiles (store_id, billing_plan_id)
select s.id, (select id from preferred_plan)
from public.stores s
where not exists (
  select 1
  from public.store_billing_profiles sbp
  where sbp.store_id = s.id
)
and (select id from preferred_plan) is not null;

create or replace function public.ensure_store_billing_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preferred_plan_id uuid;
begin
  select id
  into preferred_plan_id
  from public.billing_plans
  where key in ('standard', 'starter')
    and active = true
  order by case when key = 'standard' then 0 else 1 end
  limit 1;

  if preferred_plan_id is not null then
    insert into public.store_billing_profiles (store_id, billing_plan_id)
    values (new.id, preferred_plan_id)
    on conflict (store_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists stores_ensure_billing_profile on public.stores;
create trigger stores_ensure_billing_profile
after insert on public.stores
for each row execute function public.ensure_store_billing_profile();

-- Shared API rate-limiter storage for multi-instance/serverless safety.
create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hits integer not null default 1 check (hits >= 0),
  last_hit_at timestamptz not null default now()
);

create index if not exists api_rate_limits_last_hit_idx
  on public.api_rate_limits (last_hit_at);

create or replace function public.check_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  window_interval interval;
  resolved_hits integer;
  resolved_window_started_at timestamptz;
  retry_seconds integer;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) = 0 then
    raise exception 'p_bucket_key is required';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be >= 1';
  end if;

  if p_window_ms is null or p_window_ms < 1 then
    raise exception 'p_window_ms must be >= 1';
  end if;

  window_interval := make_interval(secs => p_window_ms::numeric / 1000.0);

  insert into public.api_rate_limits as arl (bucket_key, window_started_at, hits, last_hit_at)
  values (trim(p_bucket_key), now_ts, 1, now_ts)
  on conflict (bucket_key)
  do update set
    hits = case
      when arl.window_started_at <= (excluded.window_started_at - window_interval) then 1
      else arl.hits + 1
    end,
    window_started_at = case
      when arl.window_started_at <= (excluded.window_started_at - window_interval) then excluded.window_started_at
      else arl.window_started_at
    end,
    last_hit_at = excluded.last_hit_at
  returning arl.hits, arl.window_started_at
  into resolved_hits, resolved_window_started_at;

  if resolved_hits > p_limit then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from ((resolved_window_started_at + window_interval) - now_ts)))::integer
    );

    return query select false, retry_seconds;
    return;
  end if;

  return query select true, 0;
end;
$$;
