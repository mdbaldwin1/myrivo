-- Single-store deployment: remove custom-domain management table.

drop table if exists public.store_domains cascade;
