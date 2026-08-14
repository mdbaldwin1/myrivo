# Native Digital Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, first-class digital-download products with multiple files, mixed carts, protected customer delivery, and refund-aware access control.

**Architecture:** Extend the existing product and order models with explicit fulfillment type, immutable digital asset versions, and paid-order entitlements. Keep originals in private Supabase Storage, authorize every download through a server route, and adapt the existing Catalog, storefront, checkout, notification, customer-order, and merchant-order surfaces conditionally.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Postgres/Storage, Stripe Checkout/Connect, Vitest, Resend-backed notification dispatcher.

## Global Constraints

- Product types are exactly `physical` and `digital`; existing products default to `physical`.
- One product cannot mix physical and digital variants.
- A product supports up to 20 digital files, each at most 250 MB.
- Allowed MVP deliverables are JPG, PNG, PDF, and ZIP.
- Access-page links expire after 48 hours.
- Each purchased file has five lifetime download grants; link regeneration never resets grants.
- Raw access tokens, private paths, and signed storage URLs must never be logged or exposed in storefront payloads.
- Digital-only checkout omits phone and physical fulfillment; mixed carts retain existing physical fulfillment behavior.
- Full successful refunds revoke digital access; partial refunds preserve it; open disputes suspend it.
- Physical-only behavior must remain unchanged.
- Follow existing Tailwind, one-component-per-file, configuration, audit snapshot, and notification patterns.

---

### Task 1: Database foundation and shared domain types

**Files:**
- Create: `supabase/migrations/20260812170000_native_digital_products.sql`
- Create: `apps/web/lib/digital-products/config.ts`
- Create: `apps/web/lib/digital-products/domain.ts`
- Modify: `apps/web/types/database.ts`
- Test: `apps/web/tests/digital-products-domain.test.ts`

**Interfaces:**
- Produces `ProductType`, `DigitalAssetStatus`, `DigitalEntitlementStatus`, `DIGITAL_PRODUCT_CONFIG`, `resolveApplicableDigitalAssets`, `isDigitalProductPublishable`, and typed database records.
- Later tasks consume the schema tables `digital_product_assets`, `digital_product_asset_versions`, `digital_order_entitlements`, `digital_order_access_tokens`, and `digital_download_grants`.

- [ ] Write tests proving product-wide assets apply to all variants, variant assets apply only to their variant, inactive/failed assets are excluded, and publishing requires a ready preview plus applicable ready assets.
- [ ] Run `npm test -- --run apps/web/tests/digital-products-domain.test.ts` and verify failure because the domain module is absent.
- [ ] Add centralized constants: 48-hour access TTL, five grants, 20 files, 250 MB, accepted MIME/extension pairs, signed-storage TTL, and grace-window duration.
- [ ] Add the domain types and pure asset-resolution/publishability functions with no database dependency.
- [ ] Add the migration with product type and rights-affirmation columns, immutable asset/version records, preview metadata, order consent snapshots, entitlement status/counters, hashed access tokens, download grant reservations, indexes, uniqueness constraints for idempotency, and tenant-safe RLS policies.
- [ ] Update generated-style TypeScript record types by hand to match repository conventions.
- [ ] Run the focused tests, typecheck the web package, and commit `feat: add digital product data model`.

### Task 2: Merchant digital file upload and preview processing API

**Files:**
- Create: `apps/web/lib/digital-products/storage.ts`
- Create: `apps/web/lib/digital-products/watermark.ts`
- Create: `apps/web/app/api/products/digital-assets/upload-url/route.ts`
- Create: `apps/web/app/api/products/digital-assets/route.ts`
- Create: `apps/web/app/api/products/digital-assets/[assetId]/route.ts`
- Modify: `apps/web/app/api/products/route.ts`
- Test: `apps/web/tests/digital-product-assets-route.test.ts`
- Test: `apps/web/tests/digital-product-watermark.test.ts`

**Interfaces:**
- Produces signed private-upload authorization, asset finalize/list/update/remove endpoints, `validateDigitalAssetFile`, and `generateWatermarkedPreview`.
- Consumes owner-store authorization and the Task 1 schema/config.

- [ ] Write route tests for owner authorization, type/size/count rejection, product/variant ownership, private path construction, finalize idempotency, and purchased-version removal protection.
- [ ] Write watermark tests for deterministic output metadata, reduced dimensions, tiled store-name watermark configuration, and rejection of unsupported sources.
- [ ] Run focused tests and verify they fail.
- [ ] Implement private bucket creation/access helpers and signed upload URLs scoped to `store/product/asset/version` paths.
- [ ] Implement asset finalize/list/replace/retire endpoints; replacements create versions and never overwrite purchased objects.
- [ ] Implement image preview generation using the repository-supported image library, saving only the reduced watermarked output to the public product-media bucket.
- [ ] Extend product create/update validation for `productType` and `digitalRightsAffirmedAt`, preventing activation unless publishability checks pass.
- [ ] Run focused tests plus `npm run typecheck`, then commit `feat: add secure digital asset uploads`.

### Task 3: Catalog and product editor UX

**Files:**
- Create: `apps/web/components/dashboard/digital-product-files-panel.tsx`
- Create: `apps/web/components/dashboard/digital-product-type-field.tsx`
- Modify: `apps/web/components/dashboard/product-manager-domain.ts`
- Modify: `apps/web/components/dashboard/product-manager.tsx`
- Modify: `apps/web/app/dashboard/stores/[storeSlug]/catalog/page.tsx`
- Test: `apps/web/tests/digital-product-catalog.test.tsx`
- Test: `apps/web/tests/products-route.test.ts`

**Interfaces:**
- Consumes Task 2 asset endpoints.
- Produces conditional Catalog columns/tabs and create/edit payloads containing `productType` and rights affirmation.

- [ ] Write component tests verifying Physical/Digital selection, hidden inventory/made-to-order fields for digital products, Files versus Inventory inspector tabs, fulfillment labels, upload states, and rights/publish readiness errors.
- [ ] Extend products-route tests for physical defaulting and digital activation rejection without assets/preview/affirmation.
- [ ] Run focused tests and verify failure.
- [ ] Add `product_type` and digital summary fields to catalog loading and domain types.
- [ ] Extract a single-purpose product-type selector and Files panel to avoid further inflating `product-manager.tsx`.
- [ ] Adapt the table to Fulfillment, keep inventory inside the physical inspector, and add the digital Files tab.
- [ ] Add conditional Product-step controls while preserving Variant and Option navigation.
- [ ] Run focused tests, lint changed files, and typecheck; commit `feat: add digital product catalog workflow`.

### Task 4: Storefront data, product detail, and cart classification

**Files:**
- Create: `apps/web/lib/digital-products/cart.ts`
- Create: `apps/web/components/storefront/digital-product-summary.tsx`
- Modify: `apps/web/lib/storefront/load-storefront-data.ts`
- Modify: `apps/web/lib/storefront/runtime.ts`
- Modify: `apps/web/components/storefront/storefront-product-detail-page.tsx`
- Modify: `apps/web/components/storefront/storefront-cart-page.tsx`
- Test: `apps/web/tests/digital-product-cart.test.ts`
- Test: `apps/web/tests/storefront-product-detail-page.test.ts`
- Test: `apps/web/tests/storefront-cart-page.test.tsx`

**Interfaces:**
- Produces `classifyCartFulfillment(items)` returning `physical-only`, `digital-only`, or `mixed`, and storefront product fields with safe public preview/file-count metadata only.
- Consumes no private asset paths.

- [ ] Write tests for cart classification, digital quantity normalization to one, and safe storefront serialization.
- [ ] Write UI tests for Digital download labeling, included-file summary, no inventory copy, no quantity control, and preserved physical behavior.
- [ ] Run focused tests and verify failure.
- [ ] Extend storefront loading/runtime types with product type, public preview URL, included file count, and format labels—never private paths.
- [ ] Implement cart classification and normalize persisted digital quantities.
- [ ] Add the focused digital summary component and adapt product detail conditionally.
- [ ] Add per-line digital delivery labels in cart while retaining the existing layout.
- [ ] Run focused tests, lint, and typecheck; commit `feat: render digital products in storefront`.

### Task 5: Digital-only and mixed checkout

**Files:**
- Create: `apps/web/lib/digital-products/checkout.ts`
- Modify: `apps/web/app/api/orders/checkout/route.ts`
- Modify: `apps/web/components/storefront/storefront-cart-page.tsx`
- Modify: `supabase/migrations/20260812170000_native_digital_products.sql`
- Test: `apps/web/tests/digital-product-checkout.test.ts`
- Test: `apps/web/tests/checkout-stripe-tax-liability.test.ts`

**Interfaces:**
- Produces `resolveDigitalCheckoutRequirements`, consent snapshots, and checkout RPC item snapshots containing product type.
- Consumes Task 4 cart classification and Task 1 configuration.

- [ ] Write tests proving digital-only checkout omits phone, fulfillment, shipping address/options, and shipping fees while mixed carts retain them.
- [ ] Write tests for required consent, fixed digital quantity, free-shipping scope, Stripe metadata, and digital tax-code configuration.
- [ ] Run focused tests and verify failure.
- [ ] Implement server-side classification from authoritative product rows rather than trusting the client.
- [ ] Make phone and fulfillment conditional, persist exact consent/license versions and acceptance time, and include product type in pending/order-item snapshots.
- [ ] Adapt the cart form to hide irrelevant controls and require an accessible acknowledgment only when digital goods are present.
- [ ] Update the transactional/stub checkout database function in the migration so physical inventory decrements only for physical items.
- [ ] Run focused tests, lint, and typecheck; commit `feat: support digital and mixed checkout`.

### Task 6: Idempotent entitlement creation and delivery notifications

**Files:**
- Create: `apps/web/lib/digital-products/entitlements.ts`
- Create: `apps/web/lib/notifications/digital-delivery-email.ts`
- Modify: `apps/web/lib/storefront/checkout-finalization.ts`
- Modify: `apps/web/lib/notifications/order-emails.ts`
- Modify: `apps/web/components/storefront/storefront-checkout-page.tsx`
- Modify: `apps/web/app/api/orders/checkout-status/route.ts`
- Test: `apps/web/tests/digital-product-entitlements.test.ts`
- Test: `apps/web/tests/digital-delivery-email.test.ts`
- Test: `apps/web/tests/checkout-finalization.test.ts`

**Interfaces:**
- Produces `ensureDigitalEntitlementsForOrder(orderId)`, `issueOrderAccessToken(orderId, reason)`, and `sendDigitalDeliveryNotification(orderId)`.
- Later download routes consume entitlement and token records.

- [ ] Write tests for exact purchased-version snapshots, product/variant applicability, duplicate finalization, five-grant defaults, email retry audit behavior, and no entitlement before paid status.
- [ ] Run focused tests and verify failure.
- [ ] Implement an idempotent entitlement service using unique order-item/version constraints.
- [ ] Implement cryptographically random access tokens, store only SHA-256 hashes, and return raw tokens only to the immediate caller.
- [ ] Add a digital-delivery email section linking to the protected order access page; exclude file URLs and tokens from logs/audit payloads.
- [ ] Invoke entitlement and notification work from live and stub finalization without duplicating existing order-created notifications.
- [ ] Return digital readiness from checkout status and show View downloads only after readiness.
- [ ] Run focused tests, lint, and typecheck; commit `feat: fulfill paid digital orders`.

### Task 7: Guest access and atomic downloads

**Files:**
- Create: `apps/web/lib/digital-products/access.ts`
- Create: `apps/web/app/api/digital-orders/request-access/route.ts`
- Create: `apps/web/app/api/digital-orders/[orderId]/route.ts`
- Create: `apps/web/app/api/digital-orders/[orderId]/download/[entitlementId]/route.ts`
- Create: `apps/web/app/digital-order/[orderId]/page.tsx`
- Create: `apps/web/components/customer/digital-downloads-panel.tsx`
- Test: `apps/web/tests/digital-order-access.test.ts`
- Test: `apps/web/tests/digital-download-route.test.ts`

**Interfaces:**
- Produces authenticated/guest entitlement listing and atomic short-lived private URL issuance.
- Consumes Task 6 token hashes and Task 1 entitlement/grant tables.

- [ ] Write tests for token hashing, 48-hour expiry, neutral regeneration responses, store/order scoping, signed-in ownership, rate limiting, suspended/revoked access, and no raw secrets in responses except the immediate redirect URL.
- [ ] Write concurrent download tests proving at most five reservations and grace-window reuse.
- [ ] Run focused tests and verify failure.
- [ ] Implement access-token validation and request-access rate limiting with the existing database-backed limiter pattern.
- [ ] Implement entitlement listing with customer-safe metadata.
- [ ] Implement atomic grant reservation via a Postgres function in the migration; issue a private signed URL for only a few minutes and release/avoid the grant if signing fails.
- [ ] Build the protected guest/customer page and reusable Downloads panel with remaining counts and fresh-link request.
- [ ] Run focused tests, lint, and typecheck; commit `feat: add protected digital downloads`.

### Task 8: Customer and merchant order surfaces

**Files:**
- Create: `apps/web/components/dashboard/order-digital-delivery-panel.tsx`
- Modify: `apps/web/components/customer/customer-order-detail-view.tsx`
- Modify: `apps/web/components/dashboard/order-detail-panel.tsx`
- Modify: `apps/web/components/dashboard/orders-manager.tsx`
- Modify: `apps/web/app/api/customer/orders/[orderId]/route.ts`
- Modify: `apps/web/app/api/orders/[orderId]/route.ts`
- Modify: `apps/web/app/api/orders/route.ts`
- Test: `apps/web/tests/digital-order-surfaces.test.tsx`
- Test: `apps/web/tests/customer-order-detail-route.test.ts`
- Test: `apps/web/tests/order-detail-route.test.ts`

**Interfaces:**
- Consumes entitlement summaries and resend service.
- Produces digital-only `Files delivered` and mixed-order secondary delivery status.

- [ ] Write route and component tests for customer Downloads placement, merchant delivery status/email/access facts, resend action, digital-only list labels, and mixed-order physical status preservation.
- [ ] Run focused tests and verify failure.
- [ ] Add entitlement summaries to customer/merchant order APIs without private paths.
- [ ] Reuse the Downloads panel on customer order detail.
- [ ] Add the focused merchant Digital delivery panel and activity entries.
- [ ] Adapt order-list fulfillment rendering so digital-only orders never show Pending fulfillment or Not shipped.
- [ ] Run focused tests, lint, and typecheck; commit `feat: surface digital order delivery`.

### Task 9: Refund and dispute access state

**Files:**
- Create: `apps/web/lib/digital-products/refunds.ts`
- Modify: `apps/web/components/dashboard/order-refund-request-panel.tsx`
- Modify: `apps/web/app/api/orders/refunds/[refundId]/route.ts`
- Modify: `apps/web/lib/orders/disputes.ts`
- Test: `apps/web/tests/digital-product-refunds.test.ts`
- Test: `apps/web/tests/order-refund-execution-route.test.ts`
- Test: `apps/web/tests/refund-dispute-sync.test.ts`

**Interfaces:**
- Produces `applyDigitalAccessForRefund` and `applyDigitalAccessForDispute`.
- Consumes entitlement status transitions and activity auditing.

- [ ] Write tests for accessed-file warnings, full successful refund revocation, partial refund preservation, failed refund preservation, dispute suspension, dispute restoration, and lost-dispute revocation.
- [ ] Run focused tests and verify failure.
- [ ] Implement idempotent entitlement status transitions and activity audit records.
- [ ] Invoke transitions only after authoritative Stripe/stub refund or dispute outcomes.
- [ ] Extend the refund dialog with access-used policy warning and explicit revocation effect; do not imply item-level refunds exist.
- [ ] Run focused tests, lint, and typecheck; commit `feat: enforce digital refund access policy`.

### Task 10: Studio previews, documentation, and end-to-end verification

**Files:**
- Modify: `apps/web/components/dashboard/storefront-studio-storefront-editor-product-detail-tab.tsx`
- Modify: `apps/web/components/dashboard/storefront-studio-storefront-editor-cart-tab.tsx`
- Modify: `apps/web/components/dashboard/storefront-studio-storefront-editor-order-summary-tab.tsx`
- Modify: `apps/web/lib/email-studio/model.ts`
- Modify: `apps/web/lib/email-studio/render.ts`
- Modify: `apps/web/e2e/full-merchant-journey.spec.ts`
- Modify: `docs/env-matrix.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Test: `apps/web/tests/digital-product-studio.test.tsx`
- Test: `apps/web/tests/email-studio-preview.test.ts`

**Interfaces:**
- Completes feature-flagged rollout and documentation.

- [ ] Write tests for digital-only/mixed Storefront Studio states and safe Email Studio rendering without raw token or storage variables.
- [ ] Add E2E coverage for merchant creation/upload, digital-only checkout, mixed checkout, download, regeneration, and refund revocation using stub/test-mode fixtures.
- [ ] Run focused tests and verify failure before implementation.
- [ ] Add studio preview state controls and digital delivery copy fields using existing document models.
- [ ] Add feature-flag/config documentation, storage requirements, rollout/runbook notes, legal-review warning, and `[Unreleased]` changelog entry.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Run the scoped E2E flow when required credentials are available; otherwise record the exact skipped credential dependency.
- [ ] Inspect the full git diff for secrets, private paths, unrelated changes, and migration reversibility.
- [ ] Commit `feat: complete native digital products`.
