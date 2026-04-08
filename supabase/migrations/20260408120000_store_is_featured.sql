-- Add is_featured flag to stores for homepage featured store section
alter table stores add column if not exists is_featured boolean not null default false;

-- Index for efficient featured store lookups
create index if not exists idx_stores_is_featured on stores (is_featured) where is_featured = true;
