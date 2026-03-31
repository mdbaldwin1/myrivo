alter table public.promotions
  drop constraint if exists promotions_discount_type_check;

alter table public.promotions
  add constraint promotions_discount_type_check
  check (discount_type in ('percent', 'fixed', 'free_shipping'));

alter table public.promotions
  drop constraint if exists promotions_discount_value_check;

alter table public.promotions
  add constraint promotions_discount_value_check
  check (discount_value >= 0);
