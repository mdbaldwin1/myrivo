# Task 12 Report: Finish Buyer Product, Cart, Stripe Return, and Order UX

## Status

Complete on `codex/digital-products`. Digital-only and mixed purchases now have explicit product, cart, post-payment, customer-order, merchant-operations, refund, and dispute states without exposing private storage paths or persisting/logging bearer access URLs.

## Implementation

### Product detail and cart composition

- Digital product detail now uses the exact public preview, labels the product as a digital download, shows the selected variant's file count/formats/labels, explains immediate secure delivery and the personal-use license, fixes quantity at one, and replaces physical stock/made-to-order language.
- The live storefront loader supplies only a public preview URL plus ready file labels, variant applicability, and formats. It neither selects nor serializes original storage paths or customer filenames.
- Cart lines are grouped into Digital delivery and Physical items. Digital quantity controls stay absent, while physical quantity behavior remains unchanged.
- Digital-only carts skip phone and fulfillment requirements; mixed carts label shipping/pickup as physical-only cost. Immediate-delivery consent now sits directly before payment and links to the personal-use license and digital refund policy.

### Post-payment first access

- Checkout status carries the immutable checkout composition and continues polling completed orders while digital delivery remains pending or processing.
- A succeeded delivery reconstructs the purchase access bearer in server memory from the HMAC derivation nonce, verifies it against the stored hash with a timing-safe comparison, and returns a relative `/downloads/{token}` URL only for the matching active, unexpired purchase token and succeeded delivery job.
- The raw access URL is not stored or logged. Pending, failed, expired, revoked, malformed, and integrity-invalid states do not receive it.
- Stripe return shows Preparing files with retry-safe/no-double-charge guidance, a prominent View downloads action when ready, 48-hour emailed-link guidance, mixed-order physical next steps, and the existing safe support path for terminal delivery failure.

### Customer order states

- Customer order pages load entitlement metadata only after signed-in email ownership is established and pass only aggregate file counts/access state to the client.
- Active and partially available orders offer short direct access plus emailed recovery. Open-dispute suspension and full-refund revocation are explained explicitly and suppress unusable access/recovery controls.
- Downloads appear above physical fulfillment content. Digital-only orders omit the misleading pending-fulfillment badge and physical timeline/fulfillment card.

### Merchant delivery operations and refunds

- Merchant order detail now loads a safe digital aggregate only for orders containing digital items. It includes manifest count, delivery/email status, attempt summaries, first/latest access, current-link expiry, customer filenames/formats, per-file grants remaining, entitlement state, and active-dispute state without token values, storage paths, job IDs, or internal failure text.
- Digital delivery is rendered separately from physical fulfillment. Digital-only orders do not show pending physical fulfillment, carrier, tracking, or shipment status.
- Merchant resend uses the existing tenant-authorized route with a stable idempotency key across retries and rotates the key after success. Revoked or not-yet-delivered access cannot invoke resend.
- Refund confirmation states that a successful full refund revokes all access and a partial refund preserves all entitlements/grants. If any file was accessed, the accepted immediate-delivery policy/version and timestamp are shown while preserving the merchant override path.

## TDD Evidence

### RED

- Checkout-access tests initially failed because no server-only purchase bearer reconstruction existed.
- Stripe-return tests failed while completed-but-processing delivery stopped polling and no safe first-access action or mixed-order next step existed.
- Cart tests failed before digital/physical grouping and immediately-before-payment consent existed.
- Merchant route/panel tests failed before the safe aggregate, digital delivery panel, and physical-status separation were connected.
- Customer tests failed before direct/partial, dispute, full-refund, and digital-only order states were represented.
- Live product-data tests failed before the storefront loader supplied the safe public-preview/file summary.

### GREEN

Focused Task 12 regression evidence:

```text
Test Files 16 passed (16)
Tests 46 passed (46)
```

Coverage includes digital-only and mixed carts, processing/succeeded/failed checkout return, expired and integrity-invalid checkout access, public-preview disclosure boundaries, active/partial/refunded/disputed customer orders, delivery/email failure and attempts, resend idempotency, grants/access evidence, and full/partial refund impact.

## Validation

- `npm run lint` — passed with zero warnings/errors; feedback and dashboard-route consistency checks passed.
- `npm run typecheck` — passed.
- `npm test` — 258 files and 1,002 tests passed.
- `npm run build` — passed; optimized Next.js production compilation and TypeScript validation completed.
- `git diff --check` — passed.

The full suite retained the pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing Next.js middleware deprecation and stale Browserslist-data warnings.

## Principal Files

- `apps/web/components/storefront/storefront-product-detail-page.tsx`
- `apps/web/components/storefront/storefront-cart-page.tsx`
- `apps/web/components/storefront/storefront-checkout-page.tsx`
- `apps/web/components/customer/customer-order-detail-view.tsx`
- `apps/web/components/customer/digital-order-downloads.tsx`
- `apps/web/components/dashboard/order-detail-panel.tsx`
- `apps/web/components/dashboard/digital-order-delivery-panel.tsx` (new)
- `apps/web/components/dashboard/order-refund-request-panel.tsx`
- `apps/web/lib/digital-products/checkout-access.ts` (new)
- `apps/web/lib/digital-products/order-summary.ts` (new)
- `apps/web/lib/digital-products/storefront-summary.ts` (new)
- `apps/web/app/api/orders/checkout-status/route.ts`
- `apps/web/app/api/orders/[orderId]/route.ts`
- `apps/web/app/api/customer/orders/[orderId]/route.ts`
- `apps/web/tests/digital-buyer-product-ux.test.tsx` (new)
- `apps/web/tests/digital-cart-composition.test.tsx` (new)
- `apps/web/tests/digital-checkout-access.test.ts` (new)
- `apps/web/tests/digital-checkout-return.test.tsx` (new)
- `apps/web/tests/digital-customer-order-ux.test.tsx` (new)
- `apps/web/tests/digital-order-delivery-panel.test.tsx` (new)
- `apps/web/tests/digital-order-summary.test.ts` (new)
- `apps/web/tests/digital-refund-policy-ux.test.tsx` (new)
- `apps/web/tests/digital-storefront-summary.test.ts` (new)
- `CHANGELOG.md`

## Handoff

- Post-payment first access intentionally fails closed: if delivery is not succeeded or the active purchase token cannot be reconstructed and verified, the response contains no bearer URL and the buyer remains on the retry-safe preparing/support path.
- Refund/dispute access transitions remain owned by their existing webhook/database workflow; this task makes their current entitlement states and policy consequences explicit in customer and merchant UX.

## Fix 1: Checkout Resilience, Resend Eligibility, and Form Ownership

### Changes

- Replaced the eight-attempt checkout-return loop with configurable bounded-backoff polling for up to ten minutes. Polling now aborts fetches and timers on unmount/navigation, tolerates transient response failures, and exposes a safe **Check again** action after the timeout.
- Preserved `checkoutComposition` in terminal digital-delivery failures. Mixed-order failures continue to show physical shipping/pickup next steps while digital support guidance remains visible.
- Associated all required buyer and fulfillment controls with the checkout form and added explicit composition-aware client validation. Invalid submissions stop before fetch, focus the first invalid control, expose an accessible error relationship, require phone only for physical delivery, and continue to let Stripe collect shipping addresses for shipped orders.
- Disabled merchant resend until the purchase delivery and purchase email both succeed and access remains eligible. Processing, unsent, suspended, revoked, pending, and disputed states now explain why resend is unavailable.
- Added forward migration `20260813016000_require_completed_purchase_before_digital_resend.sql`. The guarded RPC locks the matching order, requires a succeeded purchase job and succeeded/sent purchase notification bound to the same order/store, preserves the existing serialized/idempotent resend mutation, and removes `service_role` execution from the renamed unchecked implementation.

### TDD Evidence

Initial focused run:

```text
Test Files 5 failed (5)
Tests 12 failed | 16 passed (28)
```

The failures captured the old eight-poll cutoff, absent timeout retry, missing failure composition/physical next step, non-owned required controls, missing pre-fetch validation/focus, and overly broad resend availability. Two assertions were then adapted to the repository's matcher setup without weakening the behavioral checks.

Green focused evidence:

```text
UI/route/form: 28 passed (28)
PostgreSQL migration contract: 88 passed (88)
```

The PostgreSQL cases cover processing delivery denial, a succeeded job with a stuck purchase notification, success after the notification is sent, suspended entitlement denial, and concurrent duplicate eligible resends.

### Validation

- `npm run lint` — passed with zero warnings/errors; consistency checks passed.
- `npm run typecheck` — passed.
- `npm test` — 258 files and 1,010 tests passed.
- `npm run build` — passed; optimized Next.js compilation and TypeScript validation completed.
- `git diff --check` — passed.

The full suite and build retained the same pre-existing stderr and advisory warnings documented above.

## Fix 2: Unknown-Status Recovery and Purchase Email Semantics

### Changes

- Stripe success URLs now carry the immutable checkout composition as non-sensitive return context. The checkout page initializes and retains the last valid composition independently from delivery status.
- Digital-only and mixed checkout returns now keep their preparation surface visible when repeated transient, malformed, or `503` responses never produce a delivery status. At the bounded timeout, buyers can use **Check again**; retry clears the timeout state and resumes polling. Physical-only returns do not show digital recovery controls.
- Merchant order summaries now select only the `purchase_delivery` job and `purchase` notification for the initial delivery/email state. Initial-email attempt history is likewise restricted to the purchase notification IDs.
- Renamed the merchant summary fields to `initialDeliveryEmailStatus` and `initialDeliveryEmailAttempts`, making their policy meaning explicit. A later pending or failed merchant resend no longer relabels the initial purchase email or incorrectly disables another eligible resend.
- The existing guarded resend RPC remains the authoritative backend precondition and still requires a succeeded purchase job plus succeeded/sent purchase notification for the same order and store.

### TDD Evidence

Initial focused run:

```text
Test Files 5 failed | 1 passed (6)
Tests 11 failed | 13 passed (24)
```

The failures reproduced the absent unknown-status retry, missing composition in Stripe return URLs, and generic notification selection/fields that allowed a resend row to mask purchase-email state. The physical-only timeout assertion was green from the outset and confirmed digital controls stayed suppressed.

Green focused evidence:

```text
Test Files 7 passed (7)
Tests 34 passed (34)
```

Coverage includes repeated malformed `503` responses through timeout, manual retry reset and successful resumption, physical-only suppression, digital-only/mixed return context, and a succeeded purchase email with a newer failed resend whose state/attempts remain separate.

### Validation

- `npm run lint` — passed with zero warnings/errors; consistency checks passed.
- `npm run typecheck` — passed.
- `npm test` — 258 files and 1,012 tests passed.
- `npm run build` — passed; optimized Next.js compilation and TypeScript validation completed.
- `git diff --check` — passed.

The full suite and build retained the same pre-existing stderr and advisory warnings documented above.
