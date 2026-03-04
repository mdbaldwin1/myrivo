-- Normalize product options into explicit axes/values and variant mappings.

create table if not exists public.product_option_axes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  axis_id uuid not null references public.product_option_axes(id) on delete cascade,
  value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variant_option_values (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  axis_id uuid not null references public.product_option_axes(id) on delete cascade,
  value_id uuid not null references public.product_option_values(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (variant_id, axis_id)
);

create index if not exists idx_product_option_axes_store_id on public.product_option_axes(store_id);
create index if not exists idx_product_option_axes_product_id on public.product_option_axes(product_id);
create index if not exists idx_product_option_axes_sort_order on public.product_option_axes(product_id, sort_order);

create index if not exists idx_product_option_values_store_id on public.product_option_values(store_id);
create index if not exists idx_product_option_values_product_id on public.product_option_values(product_id);
create index if not exists idx_product_option_values_axis_id on public.product_option_values(axis_id);
create index if not exists idx_product_option_values_sort_order on public.product_option_values(axis_id, sort_order);

create index if not exists idx_product_variant_option_values_axis_id on public.product_variant_option_values(axis_id);
create index if not exists idx_product_variant_option_values_value_id on public.product_variant_option_values(value_id);

create unique index if not exists idx_product_option_axes_product_name_unique
  on public.product_option_axes (product_id, lower(name));

create unique index if not exists idx_product_option_values_axis_value_unique
  on public.product_option_values (axis_id, lower(value));

-- Enforce unique SKU per store for non-null skus.
create unique index if not exists idx_product_variants_store_sku_unique
  on public.product_variants (store_id, lower(sku))
  where sku is not null;

create trigger product_option_axes_set_updated_at
before update on public.product_option_axes
for each row execute function public.set_updated_at();

create trigger product_option_values_set_updated_at
before update on public.product_option_values
for each row execute function public.set_updated_at();

alter table public.product_option_axes enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variant_option_values enable row level security;

create policy product_option_axes_owner_all on public.product_option_axes
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = product_option_axes.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = product_option_axes.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy product_option_values_owner_all on public.product_option_values
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = product_option_values.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = product_option_values.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy product_variant_option_values_owner_all on public.product_variant_option_values
for all
using (
  exists (
    select 1
    from public.product_variants pv
    join public.stores s on s.id = pv.store_id
    where pv.id = product_variant_option_values.variant_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.product_variants pv
    join public.stores s on s.id = pv.store_id
    where pv.id = product_variant_option_values.variant_id
      and s.owner_user_id = auth.uid()
  )
);

create policy product_option_axes_public_read on public.product_option_axes
for select
using (
  exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = product_option_axes.product_id
      and p.status = 'active'
      and s.status = 'active'
  )
);

create policy product_option_values_public_read on public.product_option_values
for select
using (
  is_active
  and exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = product_option_values.product_id
      and p.status = 'active'
      and s.status = 'active'
  )
);

create policy product_variant_option_values_public_read on public.product_variant_option_values
for select
using (
  exists (
    select 1
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.stores s on s.id = p.store_id
    where pv.id = product_variant_option_values.variant_id
      and pv.status = 'active'
      and p.status = 'active'
      and s.status = 'active'
  )
);

-- Backfill option axes/values/mappings from existing variant option_values JSON.
with option_entries as (
  select
    pv.store_id,
    pv.product_id,
    pv.id as variant_id,
    pv.sort_order as variant_sort,
    kv.key as axis_name,
    kv.value as option_value
  from public.product_variants pv
  cross join lateral jsonb_each_text(coalesce(pv.option_values, '{}'::jsonb)) kv
  where pv.option_values is not null
)
insert into public.product_option_axes (store_id, product_id, name, sort_order)
select
  oe.store_id,
  oe.product_id,
  oe.axis_name,
  0
from option_entries oe
where not exists (
  select 1
  from public.product_option_axes existing
  where existing.product_id = oe.product_id
    and lower(existing.name) = lower(oe.axis_name)
)
group by oe.store_id, oe.product_id, oe.axis_name;

with option_entries as (
  select
    pv.store_id,
    pv.product_id,
    pv.id as variant_id,
    pv.sort_order as variant_sort,
    kv.key as axis_name,
    kv.value as option_value
  from public.product_variants pv
  cross join lateral jsonb_each_text(coalesce(pv.option_values, '{}'::jsonb)) kv
  where pv.option_values is not null
),
ranked_axes as (
  select
    a.id,
    row_number() over (
      partition by a.product_id
      order by min(oe.variant_sort), a.name
    ) - 1 as next_sort_order
  from public.product_option_axes a
  join option_entries oe
    on oe.product_id = a.product_id
   and lower(oe.axis_name) = lower(a.name)
  group by a.id, a.product_id, a.name
)
update public.product_option_axes a
set sort_order = ra.next_sort_order
from ranked_axes ra
where ra.id = a.id;

with option_entries as (
  select
    pv.store_id,
    pv.product_id,
    pv.id as variant_id,
    pv.sort_order as variant_sort,
    kv.key as axis_name,
    kv.value as option_value
  from public.product_variants pv
  cross join lateral jsonb_each_text(coalesce(pv.option_values, '{}'::jsonb)) kv
  where pv.option_values is not null
)
insert into public.product_option_values (store_id, product_id, axis_id, value, sort_order)
select
  oe.store_id,
  oe.product_id,
  a.id as axis_id,
  oe.option_value,
  0
from option_entries oe
join public.product_option_axes a
  on a.product_id = oe.product_id
 and lower(a.name) = lower(oe.axis_name)
where not exists (
  select 1
  from public.product_option_values existing
  where existing.axis_id = a.id
    and lower(existing.value) = lower(oe.option_value)
)
group by oe.store_id, oe.product_id, a.id, oe.option_value;

with option_entries as (
  select
    pv.store_id,
    pv.product_id,
    pv.id as variant_id,
    pv.sort_order as variant_sort,
    kv.key as axis_name,
    kv.value as option_value
  from public.product_variants pv
  cross join lateral jsonb_each_text(coalesce(pv.option_values, '{}'::jsonb)) kv
  where pv.option_values is not null
),
ranked_values as (
  select
    v.id,
    row_number() over (
      partition by v.axis_id
      order by min(oe.variant_sort), v.value
    ) - 1 as next_sort_order
  from public.product_option_values v
  join public.product_option_axes a on a.id = v.axis_id
  join option_entries oe
    on oe.product_id = a.product_id
   and lower(oe.axis_name) = lower(a.name)
   and lower(oe.option_value) = lower(v.value)
  group by v.id, v.axis_id, v.value
)
update public.product_option_values v
set sort_order = rv.next_sort_order
from ranked_values rv
where rv.id = v.id;

with option_entries as (
  select
    pv.store_id,
    pv.product_id,
    pv.id as variant_id,
    kv.key as axis_name,
    kv.value as option_value
  from public.product_variants pv
  cross join lateral jsonb_each_text(coalesce(pv.option_values, '{}'::jsonb)) kv
  where pv.option_values is not null
)
insert into public.product_variant_option_values (variant_id, axis_id, value_id)
select
  oe.variant_id,
  a.id as axis_id,
  v.id as value_id
from option_entries oe
join public.product_option_axes a
  on a.product_id = oe.product_id
 and lower(a.name) = lower(oe.axis_name)
join public.product_option_values v
  on v.axis_id = a.id
 and lower(v.value) = lower(oe.option_value)
on conflict (variant_id, axis_id) do nothing;
