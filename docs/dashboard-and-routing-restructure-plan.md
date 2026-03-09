# Dashboard and Routing Restructure Plan

## Objectives

1. Separate public marketing/storefront routes from account/store workspace routes.
2. Support multi-store membership cleanly.
3. Keep dashboard styling consistent with existing `/dashboard` UI patterns.
4. Introduce migration-safe redirects from legacy dashboard paths.

## Styling Constraint (Non-negotiable)

For all new account/store workspace pages:

- Reuse existing dashboard shell and primitives:
  - `apps/web/app/dashboard/layout.tsx`
  - `apps/web/components/dashboard/dashboard-page-scaffold.tsx`
  - `apps/web/components/dashboard/dashboard-page-header.tsx`
  - `apps/web/components/dashboard/section-card.tsx`
  - `apps/web/components/ui/button.tsx`
- Do not introduce a new visual system for dashboard pages.
- Preserve existing spacing, typography scale, card/border treatment, and form action bar behavior.

## Target Route Tree

- `/` marketing home
- `/pricing` pricing and fee structure
- `/docs` docs index
- `/docs/:slug` docs detail
- `/login` universal login
- `/signup` universal signup
- `/invite/:token` invite acceptance
- `/profile` user profile (all roles)
- `/settings` account preferences
- `/dashboard` account-level dashboard
- `/dashboard/stores` all store memberships (owner/staff/admin)
- `/dashboard/stores/:storeSlug` store workspace root
- `/dashboard/stores/:storeSlug/*` store-scoped feature routes
- `/s/:storeSlug` storefront

## Store-Scoped Feature Routes

- `/dashboard/stores/:storeSlug/catalog`
- `/dashboard/stores/:storeSlug/orders`
- `/dashboard/stores/:storeSlug/promotions`
- `/dashboard/stores/:storeSlug/subscribers`
- `/dashboard/stores/:storeSlug/content-workspace/home`
- `/dashboard/stores/:storeSlug/content-workspace/products`
- `/dashboard/stores/:storeSlug/content-workspace/about`
- `/dashboard/stores/:storeSlug/content-workspace/policies`
- `/dashboard/stores/:storeSlug/content-workspace/cart`
- `/dashboard/stores/:storeSlug/content-workspace/order-summary`
- `/dashboard/stores/:storeSlug/content-workspace/emails`
- `/dashboard/stores/:storeSlug/reports/insights`
- `/dashboard/stores/:storeSlug/reports/inventory`
- `/dashboard/stores/:storeSlug/reports/billing`
- `/dashboard/stores/:storeSlug/store-settings/general`
- `/dashboard/stores/:storeSlug/store-settings/branding`
- `/dashboard/stores/:storeSlug/store-settings/team`
- `/dashboard/stores/:storeSlug/store-settings/shipping`
- `/dashboard/stores/:storeSlug/store-settings/pickup`
- `/dashboard/stores/:storeSlug/store-settings/checkout-experience`
- `/dashboard/stores/:storeSlug/store-settings/domains`
- `/dashboard/stores/:storeSlug/store-settings/integrations`

## Redirect Map (Legacy -> New)

- `/dashboard/catalog` -> `/dashboard/stores/:activeStoreSlug/catalog`
- `/dashboard/orders` -> `/dashboard/stores/:activeStoreSlug/orders`
- `/dashboard/marketing/promotions` -> `/dashboard/stores/:activeStoreSlug/promotions`
- `/dashboard/marketing/subscribers` -> `/dashboard/stores/:activeStoreSlug/subscribers`
- `/dashboard/content-workspace/*` -> `/dashboard/stores/:activeStoreSlug/content-workspace/*`
- `/dashboard/reports/*` -> `/dashboard/stores/:activeStoreSlug/reports/*`
- `/dashboard/store-settings/profile` -> `/dashboard/stores/:activeStoreSlug/store-settings/general`
- `/dashboard/store-settings/checkout-rules` -> `/dashboard/stores/:activeStoreSlug/store-settings/checkout-experience`
- `/dashboard/store-settings/*` -> `/dashboard/stores/:activeStoreSlug/store-settings/*`

## Core Design Decisions

1. Use `storeSlug` in URLs, not `storeId`.
2. Resolve slug to `store.id` server-side in loaders/actions.
3. Keep one login and signup for all roles.
4. Use `returnTo` for login/signup, with allowlist validation.
5. Invite acceptance is token-driven under `/invite/:token`.

## Bead Execution Plan

## Bead 1: Route Scaffolding and IA

Scope:
- Create top-level pages and new dashboard route skeletons.

Files to add/update:
- `apps/web/app/page.tsx` (marketing home)
- `apps/web/app/pricing/page.tsx`
- `apps/web/app/docs/page.tsx`
- `apps/web/app/docs/[slug]/page.tsx`
- `apps/web/app/profile/page.tsx`
- `apps/web/app/settings/page.tsx`
- `apps/web/app/dashboard/page.tsx` (account-level shell)
- `apps/web/app/dashboard/stores/page.tsx`
- `apps/web/app/dashboard/stores/[storeSlug]/layout.tsx`
- `apps/web/app/dashboard/stores/[storeSlug]/page.tsx`

Acceptance:
- All routes render and use existing dashboard scaffolding patterns.

## Bead 2: Store Workspace Route Migration

Scope:
- Move existing store-scoped pages under `/dashboard/stores/[storeSlug]/...`.

Files to add/update:
- New page wrappers under `apps/web/app/dashboard/stores/[storeSlug]/...`
- Existing page modules currently under:
  - `apps/web/app/dashboard/catalog`
  - `apps/web/app/dashboard/orders`
  - `apps/web/app/dashboard/marketing/*`
  - `apps/web/app/dashboard/content-workspace/*`
  - `apps/web/app/dashboard/reports/*`
  - `apps/web/app/dashboard/store-settings/*`
- Shared store context utility:
  - `apps/web/lib/stores/owner-store.ts` (or adjacent helper)

Acceptance:
- Existing store features function in new route namespace.

## Bead 3: Navigation and Redirect Compatibility

Scope:
- Update navigation and add redirect layer from legacy routes.

Files to add/update:
- `apps/web/components/dashboard/dashboard-nav.tsx`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/components/dashboard/dashboard-header-back-button.tsx`
- `apps/web/next.config.js` or middleware-based redirects
- Legacy page files return server redirects to new routes

Acceptance:
- Old bookmarks continue to work; nav points to new paths only.

## Bead 4: Account Dashboard and Store Memberships

Scope:
- Convert `/dashboard` into account-level overview.
- Add memberships list and create-store flow entry.

Files to add/update:
- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/dashboard/dashboard-overview.tsx` (account mode extension or new account dashboard component)
- `apps/web/app/dashboard/stores/page.tsx`
- `apps/web/components/dashboard/*` (store list/create UI)

Acceptance:
- `/dashboard` is account-scoped; store workspace is clearly separated.

## Bead 5: Auth Return and Storefront Login Entry

Scope:
- Implement safe `returnTo` for login/signup.
- Ensure storefront-to-auth flow returns users to the origin path.

Files to add/update:
- `apps/web/components/auth/login-form.tsx`
- `apps/web/components/auth/signup-form.tsx`
- `apps/web/lib/auth/*` (return path allowlist utility)
- Storefront login entry points:
  - `apps/web/components/storefront/storefront-footer.tsx`
  - any CTA linking to `/login`

Acceptance:
- Users return to intended valid path after auth.

## Bead 6: Invite Acceptance Lifecycle

Scope:
- Implement `/invite/:token` route and acceptance flow.

Files to add/update:
- `apps/web/app/invite/[token]/page.tsx`
- `apps/web/app/api/stores/members/*` invite handlers as needed
- `apps/web/lib/auth/*` invite token validation
- `apps/web/components/dashboard/team-manager.tsx` (invite link generation/UX refinements)

Acceptance:
- Invite acceptance works for logged-in and logged-out users, with email-match enforcement.

## Bead 7: Docs Surface

Scope:
- Owner docs index/detail with stable nav.

Files to add/update:
- `apps/web/app/docs/page.tsx`
- `apps/web/app/docs/[slug]/page.tsx`
- `apps/web/content/docs/*` or `apps/web/docs-content/*`

Acceptance:
- `/docs` is navigable and production-usable.

## Bead 8: QA, Guardrails, and Cleanup

Scope:
- Update tests and remove legacy route internals after compatibility window.

Files to add/update:
- `apps/web/e2e/*` affected specs
- route-level unit/integration tests under `apps/web/tests/*`
- changelog/docs updates

Acceptance:
- `lint`, `typecheck`, `test`, and impacted e2e flows pass.

## Validation Per Bead

- `npm run -w @myrivo/web typecheck`
- `npm run -w @myrivo/web lint`
- `npm run -w @myrivo/web test`
- e2e specs for routing/auth/store switching when route behavior changes

## Risk Controls

1. Keep legacy redirects until e2e and analytics confirm migration stability.
2. Use a single helper for active-store route generation to avoid drift.
3. Keep UI component reuse mandatory for dashboard pages.
4. Disallow direct string-building of dashboard URLs in components; centralize route helpers.

## Immediate Next Bead (Ready)

Start with Bead 1 + Bead 3 in the same PR if scope remains route scaffolding + redirects only.
Then migrate page content in Bead 2 with no UI redesign.

## Execution Status

- Completed: Beads 1-8
- Last completed bead: Bead 8 (QA, guardrails, cleanup)
- Date: March 6, 2026
- Verification run: `typecheck`, `lint`, and `test` all passing after Bead 8 updates
