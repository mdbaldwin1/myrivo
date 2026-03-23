create or replace function public.purge_storefront_analytics_data(
  p_raw_event_days integer default 180,
  p_session_days integer default 365
)
returns table (
  deleted_events bigint,
  deleted_sessions bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_events bigint := 0;
  v_deleted_sessions bigint := 0;
begin
  if p_raw_event_days < 30 then
    raise exception 'p_raw_event_days must be at least 30';
  end if;

  if p_session_days < p_raw_event_days then
    raise exception 'p_session_days must be greater than or equal to p_raw_event_days';
  end if;

  with deleted as (
    delete from public.storefront_events
    where occurred_at < now() - make_interval(days => p_raw_event_days)
    returning 1
  )
  select count(*) into v_deleted_events from deleted;

  with deleted as (
    delete from public.storefront_sessions ss
    where ss.last_seen_at < now() - make_interval(days => p_session_days)
      and not exists (
        select 1
        from public.storefront_events se
        where se.session_id = ss.id
      )
    returning 1
  )
  select count(*) into v_deleted_sessions from deleted;

  return query
  select v_deleted_events, v_deleted_sessions;
end;
$$;

comment on function public.purge_storefront_analytics_data(integer, integer) is
  'Purges raw storefront analytics events and stale sessions using the default retention policy (180 days raw events, 365 days sessions).';
