update public.legal_documents
set
  key = 'platform_terms',
  title = 'Myrivo Terms and Conditions',
  description = 'Platform terms for Myrivo accounts, workspaces, and shared platform use.',
  audience = 'all',
  is_active = true
where key = 'terms';

update public.legal_documents
set
  key = 'platform_privacy',
  title = 'Myrivo Privacy Policy',
  description = 'Platform privacy and data handling policy for Myrivo accounts and services.',
  audience = 'all',
  is_active = true
where key = 'privacy';

insert into public.legal_documents (key, title, description, audience, is_active)
values
  (
    'store_privacy_base',
    'Storefront Privacy Policy Base',
    'Base privacy-policy template for customer-facing storefronts.',
    'customer',
    true
  ),
  (
    'store_terms_base',
    'Storefront Terms & Conditions Base',
    'Base terms template for customer-facing storefronts.',
    'customer',
    true
  )
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
  false,
  now(),
  now(),
  case
    when d.key = 'store_privacy_base' then
      '# Privacy Policy

{storeName} respects your privacy. This policy explains what information we collect, how we use it, and how to contact us with questions.

## Information we collect

We may collect information you provide directly when you place an order, contact us, join our email list, or otherwise interact with the storefront. This can include your name, email address, shipping information, and any details you choose to share with us.

## How we use information

We use information to:

- fulfill orders and provide customer support
- communicate about purchases, pickup, shipping, or returns
- operate and improve the storefront experience
- comply with legal and tax obligations

## Third-party services

We may rely on service providers that support payments, checkout, fulfillment, email delivery, analytics, and storefront operations. Those providers process data as needed to perform their services.

## Contact

If you have privacy questions or requests, contact us at {privacyContactEmail}.'
    else
      '# Terms & Conditions

These Terms & Conditions govern your use of the {storeName} storefront and any purchases you make from us.

## Orders

By placing an order, you agree that the information you provide is accurate and that you are authorized to use the selected payment method.

## Pricing and availability

Product availability, pricing, and fulfillment timing may change without notice. We reserve the right to correct errors, limit quantities, or cancel orders when necessary.

## Fulfillment

Shipping, pickup, returns, and support expectations are described throughout the storefront and in our policy pages. Please review those details before completing a purchase.

## Governing law

These terms are governed by the laws of {governingLawRegion}.

## Contact

If you have questions about these terms, contact us at {termsContactEmail}.'
  end,
  case
    when d.key = 'store_privacy_base' then 'seed-store-privacy-base-v1'
    else 'seed-store-terms-base-v1'
  end,
  'Initial storefront legal base template'
from public.legal_documents d
where d.key in ('store_privacy_base', 'store_terms_base')
  and not exists (
    select 1
    from public.legal_document_versions v
    where v.legal_document_id = d.id
      and v.version_label = 'v1.0'
  );
