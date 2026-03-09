create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text,
  event_type text not null,
  title text not null,
  body text not null,
  action_url text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  channel_targets jsonb not null default '{"inApp": true}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dismissed', 'read')),
  read_at timestamptz,
  sent_at timestamptz,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email')),
  provider text,
  status text not null check (status in ('sent', 'failed')),
  error text,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created_at
  on public.notifications(recipient_user_id, created_at desc);

create index if not exists idx_notifications_store_created_at
  on public.notifications(store_id, created_at desc);

create index if not exists idx_notifications_unread_lookup
  on public.notifications(recipient_user_id, read_at, status);

create unique index if not exists idx_notifications_recipient_dedupe
  on public.notifications(recipient_user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notification_delivery_attempts_notification
  on public.notification_delivery_attempts(notification_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_delivery_attempts enable row level security;

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop policy if exists notifications_recipient_select on public.notifications;
create policy notifications_recipient_select on public.notifications
for select
using (recipient_user_id = auth.uid());

drop policy if exists notifications_recipient_update on public.notifications;
create policy notifications_recipient_update on public.notifications
for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

drop policy if exists notification_delivery_attempts_recipient_select on public.notification_delivery_attempts;
create policy notification_delivery_attempts_recipient_select on public.notification_delivery_attempts
for select
using (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_delivery_attempts.notification_id
      and n.recipient_user_id = auth.uid()
  )
);
