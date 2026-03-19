# Legal Policy Architecture

## Goal

Move Myrivo legal policy management to a two-tier, platform-governed model:

- Platform legal documents:
  - govern account creation and platform use
  - owned and versioned by Myrivo admins
- Store legal documents:
  - govern customer interactions on storefronts
  - base templates owned and versioned by Myrivo admins
  - merchants only configure approved variables and limited addenda

This replaces the current store-level freeform legal authorship model.

## Current State

### Platform tier

Platform legal documents already exist as admin-managed, versioned documents:

- `legal_documents`
- `legal_document_versions`
- `legal_acceptances`

Current codepaths:

- `apps/web/components/dashboard/admin/platform-legal-panel.tsx`
- `apps/web/app/api/platform/legal/route.ts`
- `apps/web/app/api/platform/legal/versions/route.ts`
- `apps/web/app/api/platform/legal/announce/route.ts`
- `apps/web/lib/legal/documents.ts`
- `apps/web/lib/platform/legal-admin.ts`
- `apps/web/app/legal/consent/page.tsx`

These documents currently serve the platform-level policy tier correctly.

### Store tier

Store legal documents currently exist as store-scoped records:

- `store_legal_documents`
- `store_legal_document_versions`

Current codepaths:

- `apps/web/components/dashboard/store-legal-documents-form.tsx`
- `apps/web/app/api/stores/legal-documents/route.ts`
- `apps/web/lib/legal/store-documents.ts`
- `apps/web/app/privacy/page.tsx`
- `apps/web/app/terms/page.tsx`

The old merchant-authored body model has now been replaced by a composition model based on admin-owned base templates plus merchant-controlled variables and addenda.

## Ownership Model

### Platform-owned only

The following must be authored and governed by Myrivo admins:

- platform privacy policy
- platform terms and conditions
- store privacy policy base template
- store terms and conditions base template
- all clauses that describe platform-level data collection, processing, sharing, retention, security, and rights handling
- all clauses that describe core storefront product behavior implemented by Myrivo

### Merchant-configurable

Merchants may configure:

- store identity fields
- support/privacy contact details
- mailing address and business contact details
- limited structured legal variables
- limited addendum content that is explicitly scoped to merchant-specific operations

Merchants must not freely rewrite:

- core privacy practices
- core store terms framework
- platform-controlled data handling language

## Target Store Document Composition

Rendered store legal documents should be composed from:

1. admin-managed base template
2. store variables
3. merchant addenda

That means a store-facing legal document is no longer a fully authored markdown body stored at the merchant level.

## Implemented Data Model

### Platform tier

Keep using:

- `legal_documents`
- `legal_document_versions`
- `legal_acceptances`

The platform/admin tier now distinguishes:

- `platform/privacy`
- `platform/terms`
- `store/privacy_base`
- `store/terms_base`

using `legal_documents.key` values:

- `platform_privacy`
- `platform_terms`
- `store_privacy_base`
- `store_terms_base`

### Store tier

`store_legal_documents` is now used for store-level variables, addenda, and published composed snapshots rather than freeform authored bodies.

Target fields should support:

- base template version reference
- resolved structured variables
- merchant addendum content
- published composed snapshot

Version history for published store documents remains important for auditability.

## Implemented UX

### Admin Dashboard > Legal Governance

Admins manage both tiers from one governance surface:

- platform legal docs
- store legal base templates
- version history
- publishing
- announcements for platform-level required legal updates

### Store Settings > Legal

Store owners now see:

- active base template selection/version
- store-specific variables
- limited addenda fields
- preview draft
- view published
- version history

They should not see full-body legal authorship controls.

### Store Settings > Privacy

This page remains store-admin operational configuration:

- privacy contacts
- store-specific California / Do Not Sell addenda
- request intro copy
- privacy requests

## Migration Direction

Existing store-authored body markdown must be migrated carefully:

- map recognizable fields into structured variables where possible
- map merchant-specific freeform content into addenda
- flag non-mappable content for manual review

Backward compatibility is not a product goal for this refactor, but data preservation is still desirable where practical.

## Delivery Status

Completed:

1. Defined the ownership boundary and documented the target schema.
2. Extended admin legal governance to include store-level base templates.
3. Refactored storefront store-legal rendering to compose from templates + variables + addenda.
4. Replaced merchant full-body editing in Store Settings > Legal.
5. Added migration logic for existing store legal content.
6. Updated docs, tests, and rollout guidance.
