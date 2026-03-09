insert into public.legal_documents (key, title, description, audience, is_active)
values
  ('terms', 'Terms and Conditions', 'Platform terms for account and commerce usage.', 'all', true),
  ('privacy', 'Privacy Policy', 'Privacy and data handling policy.', 'all', true)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  audience = excluded.audience,
  is_active = true;

insert into public.legal_document_versions (
  legal_document_id,
  version_label,
  status,
  is_required,
  effective_at,
  published_at,
  content_markdown,
  content_hash,
  change_summary
)
select
  d.id,
  'v1.0',
  'published',
  true,
  now(),
  now(),
  case
    when d.key = 'terms' then
      'By creating an account, you agree to use Myrivo in compliance with applicable laws and platform policies.'
    else
      'Myrivo collects account and transactional data needed to operate the platform and fulfill orders.'
  end,
  case
    when d.key = 'terms' then 'seed-terms-v1'
    else 'seed-privacy-v1'
  end,
  'Initial legal baseline'
from public.legal_documents d
where d.key in ('terms', 'privacy')
  and not exists (
    select 1
    from public.legal_document_versions v
    where v.legal_document_id = d.id
      and v.version_label = 'v1.0'
  );
