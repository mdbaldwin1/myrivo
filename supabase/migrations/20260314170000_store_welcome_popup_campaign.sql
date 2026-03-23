alter table public.store_settings
  add column if not exists welcome_popup_enabled boolean not null default false,
  add column if not exists welcome_popup_headline text,
  add column if not exists welcome_popup_body text,
  add column if not exists welcome_popup_email_placeholder text,
  add column if not exists welcome_popup_cta_label text,
  add column if not exists welcome_popup_delay_seconds integer not null default 6,
  add column if not exists welcome_popup_dismiss_days integer not null default 14,
  add column if not exists welcome_popup_image_path text,
  add column if not exists welcome_popup_promotion_id uuid;

alter table public.store_settings
  add constraint store_settings_welcome_popup_delay_seconds_check
    check (welcome_popup_delay_seconds between 0 and 60);

alter table public.store_settings
  add constraint store_settings_welcome_popup_dismiss_days_check
    check (welcome_popup_dismiss_days between 1 and 365);

alter table public.store_settings
  add constraint store_settings_welcome_popup_promotion_id_fkey
    foreign key (welcome_popup_promotion_id) references public.promotions (id) on delete set null;
