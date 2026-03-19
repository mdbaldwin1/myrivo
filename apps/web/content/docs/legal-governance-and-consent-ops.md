---
slug: legal-governance-and-consent-ops
title: Legal Governance and Consent Operations
summary: Publish legal versions, communicate required updates, and produce acceptance evidence quickly.
category: Team
audience: Platform admins and compliance operators
lastUpdated: March 2026
owner: Compliance Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Two Legal Tiers
Open `/dashboard/admin/legal` to manage both:

- `Myrivo platform policies`
  - `platform_privacy`
  - `platform_terms`
- `Storefront customer-policy base templates`
  - `store_privacy_base`
  - `store_terms_base`

Platform policies drive signup/legal-consent requirements. Storefront base templates drive the customer-facing `/privacy` and `/terms` pages for every storefront.

## Publishing and Communication
Use the legal governance page to create and publish new legal versions for either tier.

After publish:

- use `Send Update Notice` for required platform-policy updates
- do not send legal-consent notices for storefront base-template updates, because those are store-policy composition changes rather than account-consent changes

## Acceptance Investigation
Use Acceptance Lookup filters for user email, store slug, document key, and version label.

Export CSV for legal evidence requests and include acceptance surface + accepted timestamp.

Acceptance evidence applies to the platform-policy tier only.

## Incident Response Tie-in
For delivery failures or dispute handling, follow `docs/runbooks/legal-update-communications.md`.

## Related Docs

- `/docs/admin-dashboard-and-operations`
- `/docs/audit-explorer-and-evidence`
- `/docs/support-operations-and-escalation`
