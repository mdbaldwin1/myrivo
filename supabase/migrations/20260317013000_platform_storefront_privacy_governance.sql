create table if not exists public.platform_storefront_privacy_settings (
  key text primary key default 'default' check (key = 'default'),
  notice_at_collection_enabled boolean not null default true,
  checkout_notice_enabled boolean not null default true,
  newsletter_notice_enabled boolean not null default true,
  review_notice_enabled boolean not null default true,
  show_california_notice boolean not null default false,
  show_do_not_sell_link boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_storefront_privacy_settings_set_updated_at on public.platform_storefront_privacy_settings;
create trigger platform_storefront_privacy_settings_set_updated_at
before update on public.platform_storefront_privacy_settings
for each row execute function public.set_updated_at();

insert into public.platform_storefront_privacy_settings (key)
values ('default')
on conflict (key) do nothing;

alter table public.platform_storefront_privacy_settings enable row level security;

drop policy if exists platform_storefront_privacy_settings_admin_manage on public.platform_storefront_privacy_settings;
create policy platform_storefront_privacy_settings_admin_manage on public.platform_storefront_privacy_settings
for all
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role = 'admin'
  )
);

drop policy if exists platform_storefront_privacy_settings_support_read on public.platform_storefront_privacy_settings;
create policy platform_storefront_privacy_settings_support_read on public.platform_storefront_privacy_settings
for select
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.global_role in ('support', 'admin')
  )
);

alter table public.store_privacy_profiles
  drop column if exists notice_at_collection_enabled,
  drop column if exists checkout_notice_enabled,
  drop column if exists newsletter_notice_enabled,
  drop column if exists review_notice_enabled,
  drop column if exists show_california_notice,
  drop column if exists show_do_not_sell_link;
