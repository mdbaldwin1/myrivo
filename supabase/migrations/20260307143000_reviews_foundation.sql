create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  review_type text not null check (review_type in ('store', 'product')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewer_email text not null,
  reviewer_name text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  verified_purchase boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  moderation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((review_type = 'store' and product_id is null) or (review_type = 'product' and product_id is not null)),
  check (char_length(reviewer_email) between 3 and 320),
  check (title is null or char_length(title) <= 120),
  check (body is null or char_length(body) <= 5000)
);

create table if not exists public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  width integer,
  height integer,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden', 'removed')),
  moderation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(storage_path) > 0),
  check (char_length(public_url) > 0),
  check (width is null or width > 0),
  check (height is null or height > 0)
);

create table if not exists public.review_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_aggregate_snapshots (
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  review_count integer not null default 0 check (review_count >= 0),
  average_rating numeric(3,2) not null default 0 check (average_rating >= 0 and average_rating <= 5),
  rating_1_count integer not null default 0 check (rating_1_count >= 0),
  rating_2_count integer not null default 0 check (rating_2_count >= 0),
  rating_3_count integer not null default 0 check (rating_3_count >= 0),
  rating_4_count integer not null default 0 check (rating_4_count >= 0),
  rating_5_count integer not null default 0 check (rating_5_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);

create index if not exists idx_reviews_store_created_at
  on public.reviews(store_id, created_at desc);

create index if not exists idx_reviews_store_status_created_at
  on public.reviews(store_id, status, created_at desc);

create index if not exists idx_reviews_product_status_created_at
  on public.reviews(product_id, status, created_at desc)
  where product_id is not null;

create index if not exists idx_reviews_store_rating_status_created_at
  on public.reviews(store_id, rating, status, created_at desc);

create index if not exists idx_reviews_reviewer_user_created_at
  on public.reviews(reviewer_user_id, created_at desc)
  where reviewer_user_id is not null;

create unique index if not exists idx_reviews_submission_dedupe
  on public.reviews(
    store_id,
    coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(order_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(reviewer_email)
  );

create index if not exists idx_review_media_review_sort
  on public.review_media(review_id, sort_order asc, created_at asc);

create unique index if not exists idx_review_media_review_sort_unique
  on public.review_media(review_id, sort_order, id);

create index if not exists idx_review_media_status
  on public.review_media(status, created_at desc);

create index if not exists idx_review_responses_store_created_at
  on public.review_responses(store_id, created_at desc);

create index if not exists idx_review_aggregate_store
  on public.review_aggregate_snapshots(store_id);

create index if not exists idx_review_aggregate_product
  on public.review_aggregate_snapshots(product_id)
  where product_id is not null;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists review_media_set_updated_at on public.review_media;
create trigger review_media_set_updated_at
before update on public.review_media
for each row execute function public.set_updated_at();

drop trigger if exists review_responses_set_updated_at on public.review_responses;
create trigger review_responses_set_updated_at
before update on public.review_responses
for each row execute function public.set_updated_at();

drop trigger if exists review_aggregate_snapshots_set_updated_at on public.review_aggregate_snapshots;
create trigger review_aggregate_snapshots_set_updated_at
before update on public.review_aggregate_snapshots
for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;
alter table public.review_media enable row level security;
alter table public.review_responses enable row level security;
alter table public.review_aggregate_snapshots enable row level security;

-- Public read: only published reviews for active stores.
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
for select
using (
  status = 'published'
  and exists (
    select 1 from public.stores s
    where s.id = reviews.store_id
      and s.status = 'active'
  )
);

-- Reviewer self-read (including pending/rejected authored rows).
drop policy if exists reviews_reviewer_self_read on public.reviews;
create policy reviews_reviewer_self_read on public.reviews
for select
using (
  reviewer_user_id is not null
  and reviewer_user_id = auth.uid()
);

-- Reviewer self-insert for authenticated accounts.
drop policy if exists reviews_reviewer_self_insert on public.reviews;
create policy reviews_reviewer_self_insert on public.reviews
for insert
with check (
  reviewer_user_id is not null
  and reviewer_user_id = auth.uid()
);

-- Store moderation/update access for active owner/admin/staff memberships.
drop policy if exists reviews_store_moderator_update on public.reviews;
create policy reviews_store_moderator_update on public.reviews
for update
using (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = reviews.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = reviews.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
);

-- Store moderation/read access to all review rows in owned store.
drop policy if exists reviews_store_moderator_read on public.reviews;
create policy reviews_store_moderator_read on public.reviews
for select
using (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = reviews.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
);

-- Public media read only for active media on published reviews.
drop policy if exists review_media_public_read on public.review_media;
create policy review_media_public_read on public.review_media
for select
using (
  status = 'active'
  and exists (
    select 1
    from public.reviews r
    join public.stores s on s.id = r.store_id
    where r.id = review_media.review_id
      and r.status = 'published'
      and s.status = 'active'
  )
);

-- Store moderators can read/update/insert/delete media for their stores.
drop policy if exists review_media_store_moderator_all on public.review_media;
create policy review_media_store_moderator_all on public.review_media
for all
using (
  exists (
    select 1
    from public.reviews r
    join public.store_memberships m on m.store_id = r.store_id
    where r.id = review_media.review_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.reviews r
    join public.store_memberships m on m.store_id = r.store_id
    where r.id = review_media.review_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
);

-- Public read for responses only when review is published and store active.
drop policy if exists review_responses_public_read on public.review_responses;
create policy review_responses_public_read on public.review_responses
for select
using (
  exists (
    select 1
    from public.reviews r
    join public.stores s on s.id = r.store_id
    where r.id = review_responses.review_id
      and r.status = 'published'
      and s.status = 'active'
  )
);

-- Store moderators can manage responses for their store.
drop policy if exists review_responses_store_moderator_all on public.review_responses;
create policy review_responses_store_moderator_all on public.review_responses
for all
using (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = review_responses.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = review_responses.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
);

-- Public read of snapshots is allowed for active stores.
drop policy if exists review_aggregate_snapshots_public_read on public.review_aggregate_snapshots;
create policy review_aggregate_snapshots_public_read on public.review_aggregate_snapshots
for select
using (
  exists (
    select 1 from public.stores s
    where s.id = review_aggregate_snapshots.store_id
      and s.status = 'active'
  )
);

-- Store moderators can manage snapshots for their store.
drop policy if exists review_aggregate_snapshots_store_moderator_all on public.review_aggregate_snapshots;
create policy review_aggregate_snapshots_store_moderator_all on public.review_aggregate_snapshots
for all
using (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = review_aggregate_snapshots.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships m
    where m.store_id = review_aggregate_snapshots.store_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'staff')
  )
);
