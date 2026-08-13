# Task 6 Report: Authoritative Digital Checkout Composition

## Status

Complete on `codex/digital-products`. Checkout composition is now resolved from the authoritative catalog before fulfillment, persisted as an immutable transaction snapshot, and enforced consistently by the cart, checkout API, Stripe recovery path, finalizer, and PostgreSQL order/inventory boundary.

## Implementation

### Authoritative checkout composition

- Added the typed `CheckoutComposition` contract: `digital_only`, `physical_only`, or `mixed`.
- Checkout resolves and validates product, variant, store, status, price, product type, and physical inventory before reading fulfillment or pickup configuration.
- The canonical checkout item snapshot includes `productType`, and the pending checkout persists the derived composition.
- Duplicate digital lines and digital quantities above one are rejected at the server and database boundaries. Digital inventory is intentionally ignored.
- Retry and Stripe resume paths use the persisted item/composition snapshot instead of re-resolving mutable catalog state. A legacy fallback derives composition only from the already-persisted item snapshot.

### Fulfillment and payment behavior

- Digital-only checkout skips pickup settings and location reads, requires no buyer fulfillment choice, and persists `digital_delivery` with zero shipping.
- Digital-only Stripe sessions omit billing and shipping-address collection while retaining the persisted tax configuration and required digital-delivery consent.
- Shipping promotions cannot create a nonzero digital-only shipping amount; promo previews and checkout totals use zero shipping.
- Physical-only and mixed orders retain pickup/shipping behavior, phone requirements, address handling, and free-shipping promotion support.
- Finalization discards both stale persisted and provider-supplied shipping addresses for a persisted digital-only composition.

### Cart UX and data hygiene

- Added one shared cart normalizer for local load, authenticated-cart load, merge, mutation, and persistence.
- Duplicate digital lines collapse to one item with quantity one. Physical duplicates aggregate and remain capped at 99.
- Unknown variants and malformed, non-finite, or non-positive quantities are discarded.
- Digital lines show `Instant digital delivery · Quantity 1` and do not render quantity controls.
- Digital-only carts skip pickup requests, omit phone and fulfillment from checkout payloads/analytics, and display `Digital delivery` at `$0.00`.

### Database transaction boundary

- Added a forward-only migration that stores `checkout_composition` and expands fulfillment checks to include `digital_delivery`.
- Checkout item and composition snapshots become immutable after an attempt has transaction identity.
- `create_or_reuse_storefront_checkout_attempt` validates the authoritative catalog on first creation, derives composition, and enforces composition-specific fulfillment and customer-data invariants.
- Existing retries return the locked persisted snapshot before any mutable catalog lookup.
- `stub_checkout_create_paid_order_with_manifest` creates order items from snapshot product types, validates and decrements stock only for physical lines, and creates inventory movements only for physical lines.
- Digital-only database orders are normalized to zero shipping, null phone/pickup/address state, and `digital_delivery`.

## Files

- `apps/web/lib/storefront/checkout-composition.ts` (new)
- `apps/web/app/api/orders/checkout/route.ts`
- `apps/web/components/storefront/storefront-cart-page.tsx`
- `apps/web/lib/storefront/cart.ts`
- `apps/web/lib/storefront/checkout-finalization.ts`
- `apps/web/types/database.ts`
- `supabase/migrations/20260813003000_digital_checkout_composition.sql` (new, forward-only)
- `apps/web/tests/digital-checkout-route.test.ts` (new)
- `apps/web/tests/storefront-cart.test.ts` (new)
- `apps/web/tests/storefront-cart-page.test.tsx`
- `apps/web/tests/checkout-finalization.test.ts`
- `apps/web/tests/digital-products-migration.test.ts`
- Checkout fixture updates in pickup, promotion-cap, and Stripe-tax route suites.

## TDD Evidence

### RED

The initial route regressions failed on the missing digital-only fulfillment composition, address-collection omission, persisted composition, pickup bypass, and mixed/digital shipping behavior. The cart regressions failed on duplicate React keys, non-normalized digital quantities, rendered quantity controls, phone/fulfillment payload leakage, and nonzero digital-only shipping presentation.

The migration contract initially failed because `20260813003000_digital_checkout_composition.sql` did not exist. A finalizer regression was proven red by reverting the composition-aware address resolver, and a malformed cart-quantity regression exposed `NaN`/`Infinity` persistence before the finite-number guard was added.

The first real PostgreSQL run passed 56 of 57 assertions and exposed an invalid test assumption that `min(uuid)` exists; the assertion was corrected to inspect the UUID array without weakening the production contract.

### GREEN

Focused final application/database command covered the route, cart, finalizer, pickup, promotion, Stripe tax, stub checkout, and complete migration chain:

```text
Test Files 8 passed (8)
Tests 90 passed (90)
```

The native PostgreSQL composition/migration contract contains 57 passing assertions, including fresh and upgraded schema replay, all three compositions, retry immutability, digital-only order creation, mixed inventory mutation, and RPC privilege checks.

## Validation

- `npm run lint` — passed with zero warnings/errors; repository consistency checks passed.
- `npm run typecheck` — passed.
- `npm test` — 234 files and 799 tests passed.
- `npm run build` — passed; production compilation, TypeScript, 158-page generation, optimization, and trace collection completed.
- `git diff --check` — passed.

The full suite retained only pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing Next.js middleware deprecation and stale Browserslist-data warnings. Every gate exited successfully.

## Self-Review

- **Trust boundary:** client-declared fulfillment and product type do not establish composition; the server and PostgreSQL function derive it from the catalog at initial snapshot creation.
- **Retry safety:** once a checkout attempt exists, its persisted composition and item types are authoritative and immutable; catalog changes cannot convert an in-flight retry.
- **Inventory safety:** digital stock is neither checked nor mutated; physical stock checks, rollups, decrements, and movement-ledger records remain transactional.
- **Tenant safety:** catalog validation proves store/product/variant relationships, and checkout/order RPCs retain service-role-only execution.
- **Pricing safety:** digital-only shipping is zero in UI preview, promotion application, persisted checkout, Stripe line construction, and database order creation.
- **Privacy:** digital-only checkout omits phone and address collection, and finalization cannot reintroduce a provider address.
- **Backward compatibility:** the new composition column is nullable for legacy rows, existing fulfillment constraints are forward-expanded, and legacy retry fallback uses only its persisted item snapshot.
- **UX:** digital quantities cannot drift, digital delivery is explicit, unnecessary fulfillment/contact controls and network calls are absent, and mixed carts retain familiar physical fulfillment behavior.

## Concerns

- Docker-backed Supabase reset was unavailable locally. PostgreSQL 17 executed the real fresh, upgrade, and full repository migration chains; CI should still repeat them against the project Supabase stack.
- The `bd` executable remains unavailable, so repository bead commands could not run.

## Fix Round 1: Variant-Safe Cart Normalization and Digital Policy Enforcement

### Authoritative cart normalization

- The shared storefront cart normalizer now validates each exact product/variant pair against the active catalog instead of trusting only the product ID.
- Archived, missing, and cross-product variant selections are removed. The cart page no longer silently presents the current default variant while retaining a stale variant ID.
- Storefront quick-add uses the shared normalizer during hydration, mutation, persistence, and server sync. Digital lines remain quantity one even when an older local entry contains an arbitrary quantity.
- Zero-inventory digital products remain quick-addable because digital delivery does not participate in physical stock availability.
- The mini-cart normalizes from the storefront runtime catalog before count calculation, local persistence, preview requests, updates, and authenticated cart sync. Digital preview lines show instant delivery and expose no quantity controls.
- Authenticated/local cart merge and cart-page update paths continue through the same exact active-variant normalizer.

### Database consent and license boundary

- Added a private singleton platform configuration row for the current digital consent and personal-use license versions.
- A forward-only trigger now rejects every newly inserted or materially edited digital/mixed checkout snapshot unless it contains the configured consent version, configured license version, and a non-null acceptance timestamp no more than five minutes in the future.
- Product-type inspection supplements composition inspection, so a forged or absent composition value cannot bypass the policy requirement.
- Physical-only snapshots remain unaffected, including legacy rows whose composition is null.
- The migration does not retroactively validate or rewrite existing attempts. A pre-migration digital attempt remains resolvable through the early immutable retry path.
- Policy configuration is unreadable to `anon` and `authenticated`; checkout attempt creation remains executable only by `service_role`.

### TDD evidence

RED was observed across five intended regressions:

```text
shared normalizer retained archived, missing, and cross-product variants
mini-cart preview sent a digital quantity of 9
cart page rendered the current default for a stale variant ID
storefront quick-add did not produce a normalized digital sync
database accepted a digital attempt without policy evidence
```

The first database implementation run also revealed three older digital attempt fixtures that omitted their now-required policy snapshots; those fixtures were corrected to mirror production inputs. During self-review, a new real-PostgreSQL regression proved a null-composition physical row was incorrectly entering the policy branch because of SQL three-valued boolean logic. The trigger now explicitly treats a null composition predicate as false, and the regression passes.

### Validation

- Focused checkout/cart/PostgreSQL suite — 11 files and 102 tests passed.
- Native PostgreSQL migration contract — 61 tests passed, including missing/wrong/future policy rejection, valid digital acceptance, physical-only acceptance, private configuration, full-chain replay, and pre-migration retry.
- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings/errors after correcting the mini-cart hook dependency memoization; consistency checks passed.
- `npm test` — 235 files and 807 tests passed.
- `npm run build` — passed with production compilation, TypeScript, 158-page generation, optimization, and trace collection.
- `git diff --check` — passed.

The full suite/build retained only the previously documented refund/dispute mock stderr, zero-size chart warnings, Next.js middleware deprecation notice, and stale Browserslist-data notice.

### Self-review

- **Exact selection identity:** normalization accepts only an active variant belonging to the selected product and never substitutes another variant.
- **All mutation surfaces:** home/product listing quick-add, cart hydration/update/merge, and mini-cart preview/update/persistence use the catalog-aware normalizer before emitting data.
- **Digital quantity:** duplicate or arbitrary digital quantities converge to exactly one on each covered UI path.
- **Compatibility:** runtime-less mini-cart embedding retains safe numeric normalization; normal storefront surfaces use their authoritative runtime catalog.
- **Database enforcement:** the trigger defends the persisted boundary independently of route validation and inspects both composition and item snapshots.
- **Upgrade safety:** existing checkout rows are not scanned or rewritten; an immutable pre-migration attempt retries from its stored snapshot.
- **Least privilege:** policy values are platform-owned and private, while the existing service-role-only RPC boundary remains explicit.
