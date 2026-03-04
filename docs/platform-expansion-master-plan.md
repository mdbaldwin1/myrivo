# Platform Expansion Master Plan

## Objective
Deliver a robust, production-ready expansion of Myrivo covering:
- Intelligent pickup configuration (distance-aware eligibility, hidden/visible location modes, pickup scheduling windows).
- Full identity + role architecture (platform roles + user/store relationship roles).
- Customer account dashboard (saved stores, saved items, persistent carts).
- Profile/account experience in merchant dashboard.
- Store subscription plans + configurable transaction fees.
- Public Myrivo marketing website.
- Auth UX completion (create account <-> sign in paths).
- Test mode architecture (sandbox/live behavior).
- White-labeling (domain, favicon, tenant brand controls).

Backwards compatibility is not required. Architecture, correctness, observability, and clear operator workflows are prioritized.

## Implementation Status (March 3, 2026)
- Implemented `20260303234500_platform_roles_pickup_foundation.sql` and `20260304003000_platform_expansion_phase_core.sql` for role/pickup/customer/billing/test-mode/white-label schemas.
- Added role authorization helpers in `apps/web/lib/auth/authorization.ts`.
- Added pickup engine modules and tests:
  - `apps/web/lib/pickup/distance.ts`
  - `apps/web/lib/pickup/scheduling.ts`
  - `apps/web/tests/pickup-distance.test.ts`
  - `apps/web/tests/pickup-scheduling.test.ts`
- Added pickup APIs and dashboard management:
  - `/api/stores/pickup/settings`
  - `/api/stores/pickup/locations`
  - `/api/storefront/pickup-options`
  - `PickupSettingsManager` in Store Settings -> Checkout Rules.
- Integrated pickup location/time into checkout + order snapshot + email confirmation.
- Added customer dashboard surface and APIs:
  - `/account`
  - `/api/customer/dashboard`
  - `/api/customer/saved-stores`
  - `/api/customer/saved-items`
- Added platform controls for billing/test mode/white-label:
  - `/api/stores/platform-config`
  - `PlatformControlsSettings` in Store Settings -> Integrations.
- Added fee engine foundation and persisted `order_fee_breakdowns`.
- Added custom-domain slug resolution foundation (`apps/web/lib/stores/domain-store.ts` + storefront loader integration).
- Added auth UX navigation links (login <-> signup) and merchant profile entry in dashboard sidebar.

## Program Guardrails
- Every phase requires migrations + API contracts + UI + tests + runbook updates.
- Every store-scoped operation must resolve tenant context explicitly.
- Role checks must be enforced in API authorization and RLS.
- Any checkout-affecting change requires integration and E2E coverage.
- Every user-facing behavior must have explicit failure states and recovery guidance.

## Phase Roadmap

### Phase 0: Specification + Architecture Freeze
Scope:
- Finalize domain model, API boundaries, and UX rules.
- Define role matrix, pickup behavior matrix, and billing rules.
- Decide provider boundaries (payments, geocoding, maps, email).

Deliverables:
- ADR set for role model, pickup selection policy, test mode semantics, white-label capabilities.
- Domain glossary and canonical flow diagrams.
- Acceptance test matrix by feature.

Exit criteria:
- Approved specs and acceptance matrix for all tracks.

---

### Phase 1: Identity, Role Model, and Authorization Foundation
Scope:
- Platform roles: `admin`, `support`, `user`.
- Store relationship roles: `owner`, `staff`, `customer`.
- Role-aware policy and permission matrix.

Data model:
- `user_profiles.global_role` enum updated to include canonical platform roles.
- `store_memberships.role` expanded to include `customer`.
- Optional `store_memberships.permissions_json` for fine-grained overrides.

Backend:
- Central authorization guards (`requirePlatformRole`, `requireStoreRole`, `requireStorePermission`).
- Role-aware middleware for sensitive routes.

RLS:
- Harden all store-scoped tables against cross-tenant access.
- Customer-read scope separated from merchant-write scope.

UI:
- Role-aware nav/actions in dashboard.

Tests:
- Role matrix tests for all critical API routes.

Exit criteria:
- No privileged operation reachable without explicit role checks.

---

### Phase 2: Pickup Intelligence (Locations, Radius, Scheduling)
Scope:
- Multiple pickup locations per store.
- Distance-based eligibility for pickup option.
- Configurable radius (miles/km).
- Hidden mode (auto-select nearest eligible location) vs visible mode (buyer selects among eligible locations).
- Pickup scheduling windows with lead time and available slots.

Data model:
- `store_pickup_settings`
  - `pickup_enabled`
  - `selection_mode` (`hidden_nearest`, `buyer_select`)
  - `eligibility_radius_miles`
  - `lead_time_hours`
  - `slot_interval_minutes`
  - `timezone`
  - `show_pickup_times`
  - `instructions`
- `pickup_locations`
  - name, address lines, city/state/postal/country
  - lat/lng
  - active flag
  - optional notes
- `pickup_location_hours`
  - day-of-week rules and open/close windows
- `pickup_blackout_dates`
  - date ranges and reason
- Orders extension:
  - `pickup_location_id`
  - `pickup_location_snapshot_json`
  - `pickup_window_start_at`
  - `pickup_window_end_at`
  - `pickup_timezone`

Checkout behavior:
1. Buyer provides location input (zip/postal + country minimum; full address optional).
2. Resolve candidate pickup locations by distance threshold.
3. If none in range, pickup option hidden/disabled with clear message.
4. If mode `hidden_nearest`, choose nearest eligible location automatically.
5. If mode `buyer_select`, present eligible locations sorted by distance.
6. Generate selectable pickup slots from schedule rules with lead-time enforcement.

Email behavior:
- Order confirmation includes pickup location, address, chosen pickup window, and pickup instructions.

Admin UI:
- Store Settings -> Checkout Rules -> Pickup Settings.
- Store Settings -> Pickup Locations CRUD + schedule rules.

Tests:
- Distance eligibility unit tests.
- Slot generation tests (timezone, lead-time, blackout edge cases).
- E2E for hidden mode, visible mode, out-of-radius behavior.

Exit criteria:
- Pickup can be fully configured per store and reliably enforced in checkout.

---

### Phase 3: Customer Account and Relationship Layer
Scope:
- Customer dashboard and profile.
- Saved stores, saved items, saved/persistent carts.
- Customer order history and preferences.

Data model:
- `customer_profiles`
- `customer_saved_stores`
- `customer_saved_items`
- `customer_carts` + `customer_cart_items`
- `customer_notification_preferences`

Backend:
- Customer auth route separation from merchant dashboard routes.
- Cart merge strategy for guest -> authenticated customer.

UI:
- Customer account pages for orders/saved/favorites.
- Store follow/subscription controls.

Exit criteria:
- Customer can return and continue shopping state across sessions/devices.

---

### Phase 4: Merchant Profile and Account Surface
Scope:
- Merchant profile page in bottom sidebar slot.
- Account security/preferences pages.
- Team member management (owner/staff lifecycle) where allowed.

UI:
- Sidebar bottom account link.
- Profile editor and session security views.

Exit criteria:
- Merchant identity/account settings are first-class and role-aware.

---

### Phase 5: Subscription + Transaction Fee Engine
Scope:
- Plan catalog and assignment per store.
- Fee computation model (percentage + optional fixed fee).
- Fee reporting and payout visibility.

Data model:
- `billing_plans`
- `store_billing_profiles`
- `order_fee_breakdowns`
- `billing_events`

Backend:
- Fee calculation module invoked in checkout finalization.
- Plan gating and entitlement checks.

Admin:
- Platform admin controls for plan assignment and overrides.

Tests:
- Deterministic fee calculation tests.
- Reconciliation checks against order totals.

Exit criteria:
- Subscription and fee behavior is transparent, testable, and auditable.

---

### Phase 6: Public Myrivo Marketing Site
Scope:
- Public pages for product marketing: home, features, pricing, FAQ, contact.
- CTA funnels to sign up/sign in.

Requirements:
- SEO metadata and structured content.
- Performance baseline and analytics instrumentation.

Exit criteria:
- Public site supports acquisition funnel with trackable conversion points.

---

### Phase 7: Test Mode (Sandbox/Live)
Scope:
- Explicit store-level mode: `sandbox` vs `live`.
- Sandbox-only keys and behavior paths.
- Visual mode indicators in dashboard and checkout.

Data model:
- `stores.mode`
- environment-specific integration key slots.

Behavior:
- Sandbox transactions isolated in reports and email templates.
- Guardrails prevent live key use in sandbox and reverse.

Exit criteria:
- Merchants can safely validate end-to-end workflows without touching live operations.

---

### Phase 8: White-Labeling and Custom Domain Controls
Scope:
- Per-store custom domain setup.
- Favicon and app identity overrides.
- Core email/brand appearance overrides by tenant.

Data model:
- `store_brand_assets`
- `store_domains` (verification + routing state)

Platform behavior:
- Tenant asset resolution by host.
- Per-domain SEO metadata and canonical URL handling.

Exit criteria:
- Tenant can operate storefront under their domain with their iconography/brand metadata.

---

### Phase 9: Auth UX Completion
Scope:
- Explicit navigation between create account and sign in.
- Role-path clarity for merchant vs customer sign-in flows.

Exit criteria:
- Auth surface is self-explanatory and reduces dead ends/confusion.

---

### Phase 10: Hardening, Migration, and Rollout
Scope:
- Migrate data to new schema.
- Add observability dashboards and alerts.
- Define rollback and incident runbooks.

Requirements:
- Full test matrix (unit/integration/E2E/security/regression).
- Post-migration integrity checks.
- Readiness checklist and staged rollout plan.

Exit criteria:
- Production rollout approved with green checks and runbooks in place.

## Core Cross-Cutting Technical Decisions
- Tenant context is always explicit; no hidden global fallback in critical flows.
- Business rule engines (pickup eligibility, slot generation, fee calculation) are isolated modules with pure-function test suites.
- Snapshot critical order-time values (pickup location/time, fee breakdown) to preserve historical truth.
- All user-facing calculations must be timezone-aware and deterministic.

## Validation Matrix
- Lint + typecheck gates on every bead.
- Targeted test packs per phase.
- E2E packs:
  - pickup flows
  - role-protected actions
  - billing correctness
  - customer account persistence
  - white-label host routing

## Operations and Runbooks
- New runbooks required:
  - Pickup setup and troubleshooting
  - Role escalation and access review
  - Billing discrepancy handling
  - Sandbox/live mode operations
  - Domain verification and brand asset propagation

## Sequenced Bead Backlog
1. Program architecture freeze and ADRs.
2. Role model + RLS hardening.
3. Pickup schema and scheduling primitives.
4. Pickup checkout integration.
5. Pickup admin UI + email updates.
6. Customer account data model + APIs.
7. Customer dashboard UI.
8. Merchant profile/account surface.
9. Billing/plan/fee engine.
10. Billing admin and reporting UI.
11. Public marketing site.
12. Test mode architecture.
13. White-label domain + favicon system.
14. Auth UX completion.
15. Migration/hardening/final rollout.

## Delivery Strategy
- Execute one bead in progress at a time.
- Require passing validation before bead close.
- Keep production safety controls on while introducing new capabilities.
