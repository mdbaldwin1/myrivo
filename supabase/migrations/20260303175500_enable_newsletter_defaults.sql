insert into public.store_settings (
  store_id,
  email_capture_enabled,
  email_capture_heading,
  email_capture_description,
  email_capture_success_message
)
select
  s.id,
  true,
  'Join our email list',
  'Be first to hear about new releases, restocks, and occasional offers. Unsubscribe anytime.',
  'Thanks for subscribing. You are on the list.'
from public.stores s
left join public.store_settings ss on ss.store_id = s.id
where ss.store_id is null;

update public.store_settings
set
  email_capture_enabled = true,
  email_capture_heading = coalesce(nullif(trim(email_capture_heading), ''), 'Join our email list'),
  email_capture_description = coalesce(
    nullif(trim(email_capture_description), ''),
    'Be first to hear about new releases, restocks, and occasional offers. Unsubscribe anytime.'
  ),
  email_capture_success_message = coalesce(
    nullif(trim(email_capture_success_message), ''),
    'Thanks for subscribing. You are on the list.'
  );
