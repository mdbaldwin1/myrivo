alter table public.store_settings
  add column if not exists welcome_popup_decline_label text,
  add column if not exists welcome_popup_image_layout text;
