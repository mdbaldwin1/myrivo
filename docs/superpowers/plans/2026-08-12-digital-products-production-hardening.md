# Digital Products Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current native digital-products prototype into a secure, retryable, beautiful, fully tested production feature that satisfies the approved design and cannot sell an undeliverable file bundle.

**Architecture:** Capture immutable asset-version manifests before payment, finalize orders through durable idempotent jobs, and keep access changes transactional in Postgres. Separate catalog asset management, preview processing, entitlement delivery, link issuance, and download grants behind narrow typed services so each invariant can be tested independently. Gate availability per store until migrations, operational monitoring, and real Stripe test-mode journeys pass.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/Storage/RLS/RPC, Stripe Checkout/webhooks, Resend through the existing notification dispatcher, Sharp, Tailwind CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Access links expire exactly 48 hours after issuance; merchants cannot configure this value.
- Each purchased file permits five lifetime successful grants; link regeneration never resets the count.
- A 60-second grace window reuses a recently issued grant for the same entitlement and access session.
- Storage URLs expire after 300 seconds and are never persisted, emailed, logged, or returned by storefront/catalog APIs.
- Originals remain in the private `digital-product-assets` bucket; only approved previews may be public.
- Supported originals are JPG/JPEG, PNG, PDF, and ZIP, up to 250 MiB each and 20 active files per product.
- Digital quantity is always one. Digital-only checkout omits phone and physical fulfillment. Mixed checkout retains both.
- One product is wholly physical or wholly digital; variants cannot mix fulfillment types.
- The platform license is `personal-use-v1`; immediate-delivery consent is `immediate-delivery-v1`.
- A successful full-order refund revokes all digital access; a partial monetary refund preserves it.
- Open disputes suspend access, won/prevented/closed warnings restore only dispute-suspended access, and lost disputes revoke it.
- All business limits, versions, and flags live in validated configuration modules, not UI or handler literals.
- Every API mutation enforces origin, authentication where applicable, tenant ownership, input limits, and neutral anti-enumeration responses.
- No direct pushes to `develop` or `main`; use conventional commits on `codex/digital-products` and open a PR into `develop`.

## Release Gates

1. **Data safety gate:** migration applies cleanly to a fresh database and an upgraded database; cross-tenant combinations are rejected.
2. **Commerce gate:** digital-only and mixed carts pass integration tests without physical inventory mutation for digital lines.
3. **Delivery gate:** payment retries create one manifest, one entitlement per manifest row, and one retryable delivery job.
4. **Access gate:** five-successful-grant concurrency, grace reuse, signing failure release, refund, and dispute tests pass.
5. **UX gate:** merchant, buyer, order, expired-link, Studio, accessibility, mobile, and error-state journeys pass.
6. **Operations gate:** feature flag defaults off, dashboards/alerts exist, and Stripe test-mode smoke tests are recorded.

---

### Task 1: Freeze the Production Domain Contract and Remove Prototype Ambiguity

**Files:**
- Modify: `apps/web/lib/digital-products/config.ts`
- Modify: `apps/web/lib/digital-products/domain.ts`
- Create: `apps/web/lib/digital-products/types.ts`
- Modify: `apps/web/tests/digital-products-domain.test.ts`
- Modify: `docs/superpowers/specs/2026-08-12-native-digital-products-design.md`

**Interfaces:**
- Produces: `DigitalPurchaseManifest`, `DigitalPurchaseManifestItem`, `DigitalProductReadiness`, `DigitalDeliveryState`, `resolveDigitalProductReadiness()`, and validated `DIGITAL_PRODUCT_CONFIG`.
- Consumes: existing `ProductRecord`, variant IDs, asset/version/preview statuses.

- [ ] **Step 1: Add failing domain tests for every publish invariant**

  Cover no rights affirmation, no preview, failed preview, active asset without ready version, product-wide file coverage, missing per-variant coverage, archived variants, and a fully ready product. Assert structured reasons such as `rights_missing`, `preview_not_ready`, and `variant_missing_file:<variantId>`.

- [ ] **Step 2: Run the focused tests and confirm the new cases fail**

  Run: `npm test --workspace @myrivo/web -- digital-products-domain.test.ts`
  Expected: failures because the current boolean helper cannot report complete readiness.

- [ ] **Step 3: Define immutable manifest and lifecycle types**

  Add exact fields: manifest/order/checkout/store IDs, consent/license versions, created timestamp, and item rows containing order item/product/variant/asset/asset-version IDs plus filename, MIME, byte size, checksum, label, and sort order.

- [ ] **Step 4: Implement `resolveDigitalProductReadiness()` as the sole publish rule engine**

  Return `{ ready: boolean; reasons: string[]; applicableFileCount: number; previewStatus }`; reuse it from route and UI tasks rather than duplicating predicates.

- [ ] **Step 5: Move all limits and copy-independent policy values into validated config**

  Add preview max edge/quality, supported MIME-extension pairs, link TTL, storage TTL, grant limit, grace seconds, maximum active files, feature-flag key, license version, and consent version.

- [ ] **Step 6: Update the approved design with production invariants discovered in review**

  Explicitly state that manifests are captured before Stripe session creation, delivery jobs are durable, signing failures do not consume grants, and feature rollout is store-scoped.

- [ ] **Step 7: Run focused tests and commit**

  Run: `npm test --workspace @myrivo/web -- digital-products-domain.test.ts`
  Commit: `docs: harden digital product invariants`

### Task 2: Replace the Prototype Migration with Relationally Safe, Upgrade-Safe Schema

**Files:**
- Modify: `supabase/migrations/20260812170000_native_digital_products.sql` only if never deployed
- Otherwise Create: `supabase/migrations/20260812180000_harden_digital_products.sql`
- Create: `apps/web/tests/digital-products-migration.test.ts`
- Modify: `apps/web/types/database.ts`

**Interfaces:**
- Produces: relationally constrained asset/version/preview/manifest/entitlement/token/grant/job tables and RPCs consumed by later tasks.

- [ ] **Step 1: Establish migration status before editing**

  Check local/preview/production migration history. If `20260812170000` has run anywhere shared, never rewrite it; add a forward-only hardening migration.

- [ ] **Step 2: Write migration contract tests that fail on inconsistent relationships**

  Test that store A cannot reference store B's product, a product cannot reference another product's variant, a manifest item cannot mix orders/products/assets, and a version must belong to its asset.

- [ ] **Step 3: Add composite uniqueness and foreign keys**

  Add unique `(id,store_id)` and `(id,product_id,store_id)` keys where needed, then composite FKs for product/variant/asset/version/order/item relationships. Add checks for timestamps, hashes, statuses, counts, and nonnegative ordering.

- [ ] **Step 4: Add immutable purchase manifest tables**

  Create `digital_purchase_manifests` keyed by checkout session/order and `digital_purchase_manifest_items` containing the exact asset-version snapshot. Prevent updates/deletes after manifest status becomes `locked` except service-role administrative repair functions with audit logging.

- [ ] **Step 5: Add durable delivery jobs and attempts**

  Create `digital_delivery_jobs` with unique `(order_id,job_type)`, statuses `pending|processing|succeeded|failed`, attempt count, next attempt, lease expiry, and last safe error; create `digital_delivery_attempts` without bearer tokens or signed URLs.

- [ ] **Step 6: Redesign download grant state for reserve/commit/release**

  Use `reserved|issued|released|failed`, reservation expiry, grace expiry, and a stable client/session fingerprint hash. Do not increment `download_grants_used` until commit.

- [ ] **Step 7: Add storage object policies and cleanup metadata**

  Explicitly deny public reads of originals, allow public reads only from preview bucket, and record orphan-upload expiry so abandoned direct uploads can be deleted safely.

- [ ] **Step 8: Regenerate database types and run migration tests**

  Run the repository Supabase reset/migration command and `npm test --workspace @myrivo/web -- digital-products-migration.test.ts`.

- [ ] **Step 9: Commit**

  Commit: `feat: harden digital product storage schema`

### Task 3: Build a Transactional, Idempotent Asset Lifecycle

**Files:**
- Create: `apps/web/lib/digital-products/asset-service.ts`
- Create: `apps/web/lib/digital-products/asset-validation.ts`
- Create: `apps/web/lib/digital-products/preview-service.ts`
- Modify: `apps/web/app/api/products/digital-assets/upload-url/route.ts`
- Modify: `apps/web/app/api/products/digital-assets/complete/route.ts`
- Modify: `apps/web/app/api/products/digital-assets/route.ts`
- Create: `apps/web/app/api/products/digital-assets/[assetId]/replace/route.ts`
- Create: `apps/web/app/api/products/digital-assets/reorder/route.ts`
- Create: `apps/web/app/api/products/digital-preview/route.ts`
- Create: `apps/web/tests/digital-assets-routes.test.ts`
- Create: `apps/web/tests/digital-preview-service.test.ts`

**Interfaces:**
- Produces: `createAssetUploadIntent()`, `completeAssetUpload()`, `replaceAssetVersion()`, `reorderAssets()`, `setPreviewOverride()`, `processPreview()`.

- [ ] **Step 1: Write failing authorization and lifecycle route tests**

  Cover unauthenticated, wrong store, wrong product variant, path tampering, spoofed MIME/extension, oversized stored object, 21st file, duplicate completion, replacement, reorder, remove-with-existing-entitlements, and neutral error content.

- [ ] **Step 2: Run route tests and confirm failures**

  Run: `npm test --workspace @myrivo/web -- digital-assets-routes.test.ts`

- [ ] **Step 3: Create upload intents in the database before issuing signed uploads**

  Persist server-generated asset/version IDs, expected size/MIME/name, tenant/product/variant ownership, object path, and expiry. The completion endpoint accepts only the intent ID—not arbitrary client metadata or storage paths.

- [ ] **Step 4: Verify stored bytes without loading 250 MiB into application memory**

  Use storage metadata plus a bounded streaming checksum path or a background worker. Validate detected content signature for JPG/PNG/PDF/ZIP, actual size, declared MIME, and extension. Mark failures safely and schedule orphan cleanup.

- [ ] **Step 5: Make completion and replacement transactional and idempotent**

  A repeated request returns the existing completed version. Replacement creates `version_number + 1`, never overwrites prior storage, and never changes existing entitlements.

- [ ] **Step 6: Make preview generation bounded and idempotent**

  Generate from the resized output's real dimensions—not original metadata—limit pixels/decompression, strip metadata, tile escaped store text, and save processing/ready/failed state. PDF/ZIP-only products require a separate public preview image.

- [ ] **Step 7: Validate merchant preview overrides**

  Accept only an existing public storefront-media URL owned by the same store; copy/record the stable public path and never expose the original path.

- [ ] **Step 8: Implement reorder, label edit, variant assignment, retry, replace, and safe remove APIs**

  Enforce the 20-active-file limit server-side and prohibit destructive deletion of purchased versions.

- [ ] **Step 9: Run focused tests and commit**

  Run: `npm test --workspace @myrivo/web -- digital-assets-routes.test.ts digital-preview-service.test.ts`
  Commit: `feat: make digital asset lifecycle transactional`

### Task 4: Enforce Complete Publishing Readiness in API and Catalog

**Files:**
- Modify: `apps/web/app/api/products/route.ts`
- Create: `apps/web/lib/digital-products/readiness-service.ts`
- Modify: `apps/web/components/dashboard/product-manager-domain.ts`
- Create: `apps/web/tests/digital-product-publishing.test.ts`

**Interfaces:**
- Consumes: `resolveDigitalProductReadiness()`.
- Produces: `loadDigitalProductReadiness(productId,storeId)` used by product mutation and catalog UI.

- [ ] **Step 1: Write failing publishing integration tests**

  Assert active status is rejected unless rights are affirmed, preview is ready, each active variant has at least one applicable ready version, and no asset is still processing/failed without another valid applicable asset.

- [ ] **Step 2: Confirm the tests fail against current count-only validation**

  Run: `npm test --workspace @myrivo/web -- digital-product-publishing.test.ts`

- [ ] **Step 3: Replace count-only checks with the readiness service**

  Return `400` with structured safe reasons. Use the post-update product type and validate before committing active status so a failed publish attempt does not partially change variants or metadata.

- [ ] **Step 4: Make physical↔digital conversion safe**

  Disallow conversion of products with order history unless a deliberate migration flow exists. Clear stale rights only when converting to physical and require a new affirmation when converting back.

- [ ] **Step 5: Run tests and commit**

  Commit: `fix: prevent undeliverable digital products from publishing`

### Task 5: Capture Immutable File Manifests Before Stripe Checkout

**Files:**
- Create: `apps/web/lib/digital-products/manifest-service.ts`
- Modify: `apps/web/app/api/orders/checkout/route.ts`
- Modify: `apps/web/lib/storefront/stub-checkout.ts`
- Create: `apps/web/tests/digital-purchase-manifest.test.ts`

**Interfaces:**
- Produces: `createOrReuseCheckoutManifest({ checkoutSessionId, storeId, items, consent })` and `lockManifestToOrder(manifestId,orderId)`.

- [ ] **Step 1: Write failing manifest tests**

  Prove product-wide plus selected-variant files resolve correctly, the newest ready version is captured once, catalog edits after session creation do not alter the manifest, and repeated checkout creation reuses an identical manifest fingerprint.

- [ ] **Step 2: Run tests and confirm failure**

  Run: `npm test --workspace @myrivo/web -- digital-purchase-manifest.test.ts`

- [ ] **Step 3: Resolve and validate the complete digital bundle before creating Stripe Checkout**

  Fail checkout if any selected digital variant lacks a ready applicable file or preview. Snapshot IDs and customer-facing metadata plus consent/license versions in one database transaction.

- [ ] **Step 4: Bind the manifest to the pending checkout session**

  Store `digital_manifest_id` on `storefront_checkout_sessions` and include only its opaque ID in Stripe metadata. Never place file paths or names in Stripe metadata.

- [ ] **Step 5: Lock the manifest at order creation**

  Attach order and order-item IDs deterministically; reject mutation after lock.

- [ ] **Step 6: Run tests and commit**

  Commit: `feat: snapshot digital purchases before payment`

### Task 6: Correct Digital-Only and Mixed Checkout Semantics

**Files:**
- Modify: `apps/web/app/api/orders/checkout/route.ts`
- Modify: relevant checkout RPC in a new Supabase migration
- Modify: `apps/web/components/storefront/storefront-cart-page.tsx`
- Modify: `apps/web/lib/storefront/cart.ts`
- Create: `apps/web/tests/digital-checkout-route.test.ts`
- Modify: `apps/web/tests/storefront-cart-page.test.tsx`

**Interfaces:**
- Produces: authoritative `CheckoutComposition = digital_only|physical_only|mixed` resolved before fulfillment validation.

- [ ] **Step 1: Write failing checkout matrix tests**

  Cover all three compositions, digital quantity normalization/rejection, duplicate digital cart entries, zero digital inventory, physical stock enforcement, no fulfillment config, pickup-only stores, mixed shipping, free-shipping promotions, phone requirements, Stripe address collection, and consent.

- [ ] **Step 2: Confirm current server behavior fails digital-only cases**

  Run: `npm test --workspace @myrivo/web -- digital-checkout-route.test.ts storefront-cart-page.test.tsx`

- [ ] **Step 3: Resolve product types and manifest before fulfillment settings**

  For `digital_only`, skip pickup queries/validation, set fulfillment fields to null/`digital_delivery`, force shipping fee zero, omit phone/address, and retain taxes according to configured tax mode.

- [ ] **Step 4: Separate physical inventory mutations in the checkout RPC**

  Snapshot `order_items.product_type` at transaction time. Decrement/check inventory only for physical lines; keep digital quantity exactly one.

- [ ] **Step 5: Normalize cart behavior on load and mutation**

  Collapse duplicate digital lines to one, hide controls, label delivery clearly, and ensure promo previews receive zero shipping for digital-only carts.

- [ ] **Step 6: Run focused tests and commit**

  Commit: `fix: enforce digital checkout composition rules`

### Task 7: Make Payment Finalization and Entitlement Creation Durable

**Files:**
- Replace responsibilities in: `apps/web/lib/digital-products/entitlements.ts`
- Create: `apps/web/lib/digital-products/delivery-jobs.ts`
- Create: `apps/web/lib/digital-products/delivery-worker.ts`
- Modify: `apps/web/lib/storefront/checkout-finalization.ts`
- Modify: `apps/web/app/api/orders/checkout/route.ts`
- Create: `apps/web/app/api/internal/digital-delivery/process/route.ts`
- Create: `apps/web/tests/digital-delivery-idempotency.test.ts`
- Modify: `apps/web/tests/checkout-finalization.test.ts`

**Interfaces:**
- Produces: `enqueueDigitalDelivery(orderId,manifestId)`, `claimDigitalDeliveryJob()`, `materializeEntitlementsFromManifest()`, `completeDigitalDeliveryJob()`.

- [ ] **Step 1: Write failing retry/fault-injection tests**

  Inject failure after order creation, after entitlement row 1, after token creation, and during email. Assert webhook retry converges to one manifest, complete entitlements, one active purchase token, and one successful delivery notification.

- [ ] **Step 2: Remove catalog queries from entitlement materialization**

  Create entitlements only from locked manifest items. Treat any mismatch as an operational error requiring repair, not a fallback to current catalog state.

- [ ] **Step 3: Enqueue delivery transactionally with order finalization**

  The order can be `paid` while delivery is `pending`, but a durable unique job must exist before finalization returns success. Completed checkout retries must ensure/re-enqueue missing work instead of immediately returning.

- [ ] **Step 4: Implement leased, retryable, idempotent processing**

  Use exponential backoff, bounded attempts, stale-lease recovery, safe error text, and an explicit dead-letter/merchant-visible failed state.

- [ ] **Step 5: Make token issuance idempotent**

  One purchase token per order/job; retries reuse it until delivered or explicitly revoke/replace it. Never increment an entitlement counter merely because an upsert ignored a duplicate.

- [ ] **Step 6: Run tests and commit**

  Commit: `feat: make digital delivery retryable and idempotent`

### Task 8: Integrate Reliable Digital Delivery Email and Merchant Resend

**Files:**
- Modify: `apps/web/lib/notifications/order-emails.ts`
- Modify: `apps/web/lib/notifications/dispatcher.ts` only if a new event type requires it
- Create: `apps/web/lib/digital-products/delivery-email.ts`
- Create: `apps/web/app/api/orders/[orderId]/digital-delivery/resend/route.ts`
- Create: `apps/web/tests/digital-delivery-email.test.ts`
- Create: `apps/web/tests/digital-delivery-resend-route.test.ts`

**Interfaces:**
- Produces: audited `digital_order_delivery` notification and merchant resend endpoint.

- [ ] **Step 1: Write failing email reliability tests**

  Cover configured/unconfigured sender, provider failure, dispatcher retry, duplicate job execution, merchant resend authorization, revoked order, and neutral customer content.

- [ ] **Step 2: Render download access inside the existing order-confirmation pipeline**

  Digital-only and mixed templates receive safe fields (`hasDigitalItems`, file count, 48-hour copy, access-page URL). No raw object path or signed storage URL is a template field.

- [ ] **Step 3: Record every attempt and outcome**

  Persist provider, timestamp, status, attempt number, and sanitized error. Surface failed delivery to merchants and operations.

- [ ] **Step 4: Implement merchant resend**

  Revoke stale purchase/resend tokens as policy dictates, issue one new 48-hour token without resetting grants, enqueue an audited resend, and reject unauthorized stores.

- [ ] **Step 5: Run tests and commit**

  Commit: `feat: add reliable digital delivery notifications`

### Task 9: Implement Correct Five-Grant Downloads with Grace Reuse

**Files:**
- Create/Modify migration RPCs: `reserve_digital_download`, `commit_digital_download`, `release_digital_download`
- Create: `apps/web/lib/digital-products/download-service.ts`
- Modify: `apps/web/app/api/digital-downloads/[token]/[entitlementId]/route.ts`
- Modify: `apps/web/app/api/digital-downloads/[token]/route.ts`
- Create: `apps/web/tests/digital-download-concurrency.test.ts`
- Create: `apps/web/tests/digital-download-route.test.ts`

**Interfaces:**
- Produces: `authorizeAccessToken()`, `reserveDownloadGrant()`, `commitDownloadGrant()`, `releaseDownloadGrant()`.

- [ ] **Step 1: Write failing database concurrency tests**

  Fire parallel attempts at grant 5 and assert no more than five committed grants. Test 60-second same-session reuse, reuse expiry, different-session consumption, suspended/revoked denial, expired token denial, and wrong-order entitlement denial.

- [ ] **Step 2: Reserve without consuming**

  Atomically lock entitlement, reuse eligible issued reservation, or create a short reservation. Return storage metadata only to service role.

- [ ] **Step 3: Sign, then commit; release on signing failure**

  On storage signing success, atomically mark issued and increment used count. On failure, release reservation and return a retryable error without reducing remaining grants.

- [ ] **Step 4: Add response hardening**

  Use `Cache-Control: no-store`, safe generic errors, strict token length, request throttling, security headers, and no sensitive server logs.

- [ ] **Step 5: Run concurrency and route tests repeatedly**

  Run each concurrency test at least 20 iterations to expose races.

- [ ] **Step 6: Commit**

  Commit: `fix: make digital download grants atomic`

### Task 10: Make Customer Access and Link Recovery Complete

**Files:**
- Redesign: `apps/web/app/downloads/[token]/page.tsx`
- Create: `apps/web/app/downloads/request/page.tsx`
- Create: `apps/web/components/customer/digital-download-list.tsx`
- Modify: `apps/web/components/customer/digital-order-downloads.tsx`
- Modify: `apps/web/app/api/digital-downloads/request-link/route.ts`
- Modify: customer order detail API/page
- Create: `apps/web/tests/digital-link-request-route.test.ts`
- Create: `apps/web/tests/digital-downloads-page.test.tsx`

**Interfaces:**
- Produces: complete guest recovery and authenticated order-history access surfaces.

- [ ] **Step 1: Write failing anti-enumeration and UX tests**

  Assert identical response/status/timing envelope for valid and invalid order/email pairs, case-normalized email matching, throttling by IP plus hashed order/email, successful queued email, expired/revoked/suspended states, and signed-in ownership.

- [ ] **Step 2: Make fresh-link requests operationally reliable**

  Insert token and delivery job transactionally; return neutral success only after durable queueing. Record internal failures for operations without revealing validity to the caller.

- [ ] **Step 3: Build the expired-link recovery page**

  Include order ID and email fields, clear 48-hour explanation, accessible inline errors, success confirmation, support fallback, and no dead-end instructions.

- [ ] **Step 4: Build the active download page**

  Show store/order context, file label/type/size, remaining grants, license summary/link, expiry, status, loading/error feedback, mobile layout, and keyboard/focus behavior.

- [ ] **Step 5: Give signed-in customers direct authenticated access**

  Customer order history may create a short access session without emailing, only after user/order-email ownership verification; grant rules remain unchanged.

- [ ] **Step 6: Run tests and commit**

  Commit: `feat: complete customer digital access recovery`

### Task 11: Rebuild the Merchant Catalog UX to Match the Approved Design

**Files:**
- Refactor: `apps/web/components/dashboard/product-manager.tsx`
- Create: `apps/web/components/dashboard/digital-product-overview.tsx`
- Replace: `apps/web/components/dashboard/digital-product-files.tsx`
- Create: `apps/web/components/dashboard/digital-product-file-row.tsx`
- Create: `apps/web/components/dashboard/digital-preview-manager.tsx`
- Create: `apps/web/components/dashboard/digital-publish-readiness.tsx`
- Modify: `apps/web/components/dashboard/product-manager-domain.ts`
- Create: `apps/web/tests/digital-product-files.test.tsx`
- Create: `apps/web/tests/digital-product-catalog-ux.test.tsx`

**Interfaces:**
- Consumes: asset lifecycle and readiness APIs.
- Produces: Overview/Variants/Files/Media UX with explicit readiness and file management.

- [ ] **Step 1: Write component tests for the full merchant journey**

  Create draft, affirm rights, upload multiple files, assign to variants, rename, reorder, replace, retry failed processing, remove safely, set preview override, inspect readiness, and publish. Include keyboard and screen-reader assertions.

- [ ] **Step 2: Make the catalog table fulfillment-first**

  Show Fulfillment as its own column; hide physical inventory adjustment for digital products. Keep physical behavior unchanged.

- [ ] **Step 3: Make Overview communicate readiness**

  Show type, price, file coverage, preview status, delivery/license summary, and a compact checklist with links to the exact tab/action that resolves each blocker.

- [ ] **Step 4: Make Files a polished management surface**

  Use accessible rows/cards with upload progress, status badges, label, type, size, scope, version, actions menu, optimistic reorder with rollback, replace confirmation, remove confirmation, and retry action. Support multi-select upload and per-file progress.

- [ ] **Step 5: Make the product flyout conditional**

  Hide inventory and made-to-order fields for digital products; explain that files are attached after the draft is created. Prevent leaving the rights checkbox in a misleading stale state.

- [ ] **Step 6: Make Media support preview source and override**

  Clearly distinguish storefront images from deliverables and show exactly which public preview buyers see.

- [ ] **Step 7: Run component tests, lint, and accessibility checks**

  Commit: `feat: polish digital product catalog experience`

### Task 12: Finish Buyer Product, Cart, Stripe Return, and Order UX

**Files:**
- Modify: `apps/web/components/storefront/storefront-product-detail-page.tsx`
- Modify: `apps/web/components/storefront/storefront-cart-page.tsx`
- Modify: `apps/web/components/storefront/storefront-checkout-page.tsx`
- Modify: `apps/web/components/customer/customer-order-detail-view.tsx`
- Modify: `apps/web/components/dashboard/order-detail-panel.tsx`
- Modify: `apps/web/components/dashboard/order-refund-request-panel.tsx`
- Create: `apps/web/components/dashboard/digital-order-delivery-panel.tsx`
- Create/Modify relevant component tests

- [ ] **Step 1: Write UX tests for digital-only, mixed, processing, delivered, failed, expired, refunded, and disputed states**

- [ ] **Step 2: Polish product detail**

  Show Digital download badge, selected-variant file summary without exposing private paths, delivery timing, personal-use license, fixed quantity, preview image, and digital availability copy instead of stock/made-to-order text.

- [ ] **Step 3: Polish cart composition**

  Group/label digital delivery, remove quantity controls, conditionally require phone/fulfillment, clearly separate physical shipping costs, and place consent immediately before payment with linked license/refund policy.

- [ ] **Step 4: Add the post-payment first-access surface**

  Stripe return polls finalization/delivery state and shows `View downloads` when ready, `Preparing files` while pending, retry-safe guidance on failure, and physical next steps for mixed orders.

- [ ] **Step 5: Add merchant delivery operations**

  Show manifest file count, delivery state, attempt history, first/last access, per-file grants remaining, resend action, and access status distinct from physical fulfillment.

- [ ] **Step 6: Make refund impact explicit**

  Full refund confirmation states revocation; partial states preservation; if any file was accessed, show the accepted policy and timestamp while preserving merchant override.

- [ ] **Step 7: Run tests and commit**

  Commit: `feat: finish digital order experiences`

### Task 13: Make Refund and Dispute Access Changes Transactional and Audited

**Files:**
- Modify: `apps/web/lib/orders/refund-dispute-sync.ts`
- Create: `apps/web/lib/digital-products/access-state.ts`
- Add migration RPCs for refund/dispute transitions
- Modify: `apps/web/tests/refund-dispute-sync.test.ts`
- Create: `apps/web/tests/digital-access-state.test.ts`

- [ ] **Step 1: Write failing transition and fault tests**

  Cover cumulative full refunds, partial refunds, repeated webhooks, open→won, open→lost, stale webhook ordering, full-refund then won dispute, and injected database failure.

- [ ] **Step 2: Move access transitions into idempotent database transactions**

  Update entitlements, revoke tokens where required, and insert audit events together. Never swallow failure; make webhook processing retry.

- [ ] **Step 3: Preserve terminal reasons correctly**

  A dispute win restores only rows suspended for that dispute; it never restores full-refund or lost-dispute revocations.

- [ ] **Step 4: Add reconciliation**

  Create an operations query/job that detects paid orders lacking entitlements, fully refunded orders with active access, and open/lost disputes with incorrect access state.

- [ ] **Step 5: Run tests and commit**

  Commit: `fix: synchronize digital access with financial state`

### Task 14: Add Studio States, Feature Gating, Monitoring, and Support Tooling

**Files:**
- Create: `apps/web/lib/digital-products/feature-gating.ts`
- Modify plan feature flags in billing/store configuration
- Modify Storefront Studio preview state/types/components
- Modify Email Studio model/render/preview components
- Create: `apps/web/lib/digital-products/telemetry.ts`
- Add platform operations view/API for digital delivery health
- Add relevant tests

- [ ] **Step 1: Add a store-scoped `digitalProducts` flag defaulting false**

  Enforce it in catalog creation, upload, publishing, storefront visibility, checkout, and delivery—not just UI. Existing physical behavior remains unaffected.

- [ ] **Step 2: Add Studio preview states**

  Storefront Studio: digital-only and mixed product/cart/order-summary. Email Studio: digital-only and mixed confirmation/delivery, with safe editable copy and no token variables.

- [ ] **Step 3: Instrument critical stages**

  Record upload/preview failures, manifest failures, delivery job age/failures, email attempts, link regeneration, download signing failures, grant exhaustion, reconciliation mismatches, refunds, and disputes without PII/tokens/paths.

- [ ] **Step 4: Add operational alerts and repair controls**

  Alert on paid digital orders pending beyond five minutes, repeated processing failures, and access-state mismatches. Provide audited requeue/resend/reconcile actions restricted to platform operators.

- [ ] **Step 5: Run tests and commit**

  Commit: `feat: add digital product rollout controls`

### Task 15: Security, Accessibility, Performance, and End-to-End Release Validation

**Files:**
- Create: `apps/web/e2e/digital-products.spec.ts`
- Create: `apps/web/e2e/digital-products-accessibility.spec.ts`
- Create: `docs/runbooks/digital-products.md`
- Modify: `apps/web/content/docs/catalog-and-orders.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add API security tests**

  Test CSRF/origin, authentication, tenant isolation, UUID/path tampering, MIME spoofing, decompression bombs/pixel limits, rate limiting, neutral recovery, no-store headers, token hashing, and absence of private paths in responses/log fixtures.

- [ ] **Step 2: Add complete Playwright journeys**

  Cover merchant setup through publish; digital-only purchase through email/access/download; mixed purchase; expired-link recovery; five grants plus grace reuse; replacement preserving prior buyer version; full and partial refund; dispute suspend/win/loss; delivery failure and resend.

- [ ] **Step 3: Add responsive and accessibility validation**

  Run axe on catalog/files, product, cart, checkout return, download, recovery, customer order, and merchant order at mobile and desktop sizes. Verify keyboard order, visible focus, announcements, labels, contrast, reduced motion, and 200% zoom.

- [ ] **Step 4: Add performance and abuse tests**

  Verify large uploads bypass function body limits, preview worker memory stays bounded, list queries are indexed, concurrent downloads remain correct, and endpoints degrade safely under throttling.

- [ ] **Step 5: Write the operations runbook**

  Include required environment/config, bucket policies, worker schedule, migration/rollback steps, delivery repair, token revocation, reconciliation, alerts, customer support scripts, and incident response for leaked links.

- [ ] **Step 6: Run every required quality gate fresh**

  Run: `npm run lint`
  Run: `npm run typecheck`
  Run: `npm test`
  Run: `npm run build`
  Run: project Playwright command for digital-product specs.

- [ ] **Step 7: Perform real Stripe test-mode acceptance**

  Use an internal flagged store and real Resend test recipient. Record evidence for successful digital-only/mixed payment, webhook retry, email, download, regeneration, refunds, and disputes.

- [ ] **Step 8: Conduct final independent review**

  Require separate security, code-quality, and UX reviews. Resolve all P0/P1 issues and document any accepted P2 risk before enabling merchants.

- [ ] **Step 9: Commit documentation and prepare the PR**

  Commit: `docs: add digital products operations runbook`
  PR target: `develop`; include migration order, rollout flag, screenshots, test evidence, risks, and rollback procedure.

## Recommended Execution Order and Review Checkpoints

- **Checkpoint A — Invariants:** Tasks 1–2. Independent schema/security review before application code proceeds.
- **Checkpoint B — Sellability:** Tasks 3–6. Demonstrate that only ready immutable bundles can reach payment.
- **Checkpoint C — Delivery:** Tasks 7–10. Demonstrate retry convergence and grant correctness under injected failures/concurrency.
- **Checkpoint D — Product quality:** Tasks 11–12. UX review with mobile screenshots and accessibility evidence.
- **Checkpoint E — Financial safety:** Task 13. Independent webhook/idempotency review.
- **Checkpoint F — Release:** Tasks 14–15. Feature remains off until all gates pass.

## Definition of Done

- No active digital product can lack a ready preview or a ready applicable file for any active variant.
- The exact asset versions shown at checkout are the versions entitled after payment.
- Retried checkout/webhook/job/email requests converge without duplicate entitlements, tokens, or emails.
- Digital lines never require, decrement, or display physical inventory and fulfillment data.
- Exactly five successful grants are possible; signing failures consume none; grace reuse behaves deterministically.
- Refund and dispute access changes are transactional, audited, retryable, and reconcilable.
- Merchant and customer surfaces expose every necessary state and recovery action with polished mobile/accessibility behavior.
- No private path, bearer token, or signed storage URL appears in public APIs, analytics, audit metadata, templates, or logs.
- Feature gating, monitoring, alerting, runbooks, and rollback are in place before the first non-internal store is enabled.
- Lint, typecheck, all unit/integration tests, production build, digital E2E tests, Stripe test-mode acceptance, and independent reviews pass with recorded evidence.
