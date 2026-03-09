# Feedback and Notification Consistency Plan

## Scope and Goal

Standardize how Myrivo surfaces loading, success, warning, and error feedback across dashboard, storefront, and auth flows so users see predictable, accessible, and context-appropriate messaging.

This plan covers:
- UI feedback rendering patterns
- API error response shape normalization to reduce client-side branching
- shadcn toast adoption strategy
- phased migration sequencing with quality gates

## Audit Findings (Current State)

### Coverage snapshot
- `60` API route handlers under `apps/web/app/api`
- `31` component files using `FeedbackMessage`
- `11` component files still using raw `text-red-600` inline error text
- `20` files with ad-hoc `Loading ...` copy rendering
- `127` `setError(...)` calls in components (high duplication of local async-state handling)

### Core inconsistencies

1. Mixed feedback primitives and placement
- Some screens use `FeedbackMessage`; others use raw `<p className="text-sm text-red-600">...`.
- Similar actions show feedback in different places (inside cards, at bottom of pages, near unrelated controls).
- Example raw inline errors:
  - `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/platform-console.tsx:157`
  - `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/order-detail-panel.tsx:142`
  - `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/audit-events-panel.tsx:102`

2. Loading state fragmentation
- Route-level skeleton loading exists broadly under `app/dashboard/**/loading.tsx`.
- Many mounted client components still display additional in-card “Loading …” lines, creating dual loading surfaces.
- Example:
  - `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/store-shipping-rules-form.tsx:151`
  - `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/team-manager.tsx:255`

3. Async success/error messaging modeled ad hoc
- Repeated `loading/saving/error/message` state patterns are duplicated across many components.
- Message copy and lifecycle differ (some clear on submit, some persist, some overwrite).
- Shared hook exists for one domain (`useStoreExperienceSection`) but not generalized.

4. API error contract is mostly consistent but not unified
- Most routes return `{ error: string }`, but validation routes often include `details` with varying shape.
- Shared parse helper exists (`parseJsonRequest`) but route-level usage is inconsistent.
- Frequent duplicated response phrases across routes (`Unauthorized`, `No store found for account`) indicate standardization opportunity.

5. Warning state is under-modeled
- Warning UI is mostly implicit (status chips) rather than explicit warnings with action guidance.
- Example warning-like backend response exists but is not consistently surfaced:
  - `/Users/mbaldwin/Myrivo/myrivo/apps/web/app/api/store-experience/content/route.ts:114`

## Target UX Model

### Feedback taxonomy

Use four canonical feedback channels:

1. `Field-level` (form validation)
- For invalid single input or related input set.
- Placement: directly under field.
- Component: `FormMessage`/field error helper.

2. `Section inline` (contextual persistent)
- For recoverable, local failures affecting current section/table/form.
- Placement: top of section card or just above action controls.
- Component: new `AppAlert` (shadcn `Alert`-style wrapper).

3. `Page-level banner` (blocking/high-scope)
- For failed page bootstrap or unavailable core data.
- Placement: immediately under page header.
- Component: `PageFeedbackBanner` wrapper over `AppAlert`.

4. `Toast` (transient outcomes)
- For action confirmations and non-blocking async outcomes.
- Placement: global toaster stack.
- Component: shadcn toast + app wrapper.

### Toast usage policy (what should use toast)

Use toast for:
- Successful mutations where inline persistence is not required.
- Quick operational actions (remove saved item/store, refresh tracking, copy token, status toggle).
- Background refresh outcomes.

Do NOT use toast for:
- Initial page-load failures.
- Validation errors users must fix in-form.
- Multi-error forms where persistent context is needed.
- Authentication/session failures requiring route change.

### Standard message behavior

- Errors: persistent until user action changes state or retry succeeds.
- Success:
  - Mutation confirmation: toast by default.
  - Form-save confirmation: optional inline success near action bar for sticky settings pages.
- Loading:
  - Route transitions: skeleton only.
  - In-component async actions: button pending text/spinner, not extra paragraph unless loading is long-running and local.
- Warnings:
  - Use explicit warning alert with “what this means” + optional action.

## Technical Design

### 1. New shared primitives

1. `components/ui/app-alert.tsx`
- Wrap shadcn-style `Alert` semantics.
- Variants: `error | warning | success | info`.
- Optional title/description/action slot.

2. `components/ui/toaster.tsx` + `lib/feedback/toast.ts`
- Add shadcn toast primitives and global `<Toaster />` in root layout.
- Export domain-safe helpers:
  - `notify.success(message, options?)`
  - `notify.error(message, options?)`
  - `notify.warning(message, options?)`

3. `components/ui/async-state.tsx`
- Small render helper for `loading/error/empty` states for sections and tables.
- Removes repeated conditional blocks.

4. `lib/http/client-error.ts`
- `parseApiError(response, fallback)` utility to normalize `{ error, details }` handling on client.

### 2. API response normalization

Introduce lightweight response helpers:
- `ok(data, init?)`
- `fail(status, message, details?)`

Constraints:
- Keep existing payload keys during migration to avoid broad breakage.
- Ensure all validation errors use one `details` format.
- Keep status code semantics unchanged unless incorrect.

### 3. Existing primitive migration

`FeedbackMessage` should either:
- be replaced by `AppAlert` everywhere, or
- become a thin compatibility wrapper around `AppAlert` with explicit deprecation note.

Recommendation: keep temporary wrapper for low-risk migration, then remove.

## Rollout Plan (Beads)

### Bead 1: Foundation (No behavior changes)

Implement:
- shadcn toast primitives and global `<Toaster />` integration
- `AppAlert` with variants
- `parseApiError` client helper

Acceptance:
- Compiles with no visual regressions by default
- One smoke usage of toast in a non-critical path

### Bead 2: High-churn dashboard actions to toast

Target first:
- `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/orders-manager.tsx`
- `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/dashboard/domain-manager.tsx`
- `/Users/mbaldwin/Myrivo/myrivo/apps/web/components/customer/customer-account-dashboard-panels.tsx`

Change:
- Move short-lived success messages to toast
- Keep errors inline via `AppAlert`

Acceptance:
- No loss of error visibility
- Success feedback appears once and clears automatically

### Bead 3: Standardize raw inline errors and warning surfaces

Target:
- platform/order/audit/inventory panels currently using raw `<p className="text-red-600">`
- add warning banners where warning semantics exist (e.g., degraded/partial states)

Acceptance:
- Zero remaining raw red-text error paragraphs in dashboard/storefront interactive surfaces

### Bead 4: Loading model cleanup

Target:
- Remove redundant in-component “Loading …” where route skeleton already covers initial fetch
- Keep local action pending states on buttons/controls

Acceptance:
- No duplicate loading messages on first load
- Async actions still communicate progress

### Bead 5: API contract normalization

Target:
- apply shared `fail(...)` helper to top 15 most-used dashboard/storefront routes first
- ensure client reads normalized format via `parseApiError`

Acceptance:
- Reduced ad-hoc JSON parsing branches in components
- Validation details shape consistent across migrated routes

### Bead 6: Full migration and guardrails

Implement:
- migrate remaining `FeedbackMessage` surfaces
- add lint guard or codemod checks for forbidden patterns

Guardrails:
- ban new raw `text-red-600` error paragraphs for app feedback
- ban ad-hoc toast calls outside `notify.*` wrapper

Acceptance:
- All new work follows one feedback pattern

## Testing and Verification

Per bead minimum:
- `npm run lint`
- `npm run typecheck`
- `npm test`

Additional for UI-heavy beads:
- targeted Playwright runs for dashboard actions and storefront checkout/cart flows
- manual QA checklist:
  - initial load states
  - mutation success/error paths
  - warning states and actionability
  - keyboard and screen-reader announcement behavior for alerts/toasts

## Risks and Mitigations

1. Risk: Losing persistent confirmation when moving to toast
- Mitigation: Keep inline success for long-form settings pages with explicit save/discard bars.

2. Risk: API contract migration breaks existing clients
- Mitigation: preserve current keys while introducing helpers; migrate route by route with tests.

3. Risk: Mixed old/new primitives during transition
- Mitigation: temporary compatibility wrapper + lint rules to prevent new drift.

## Immediate Recommended Next Step

Start with Bead 1 and Bead 2 together in one PR if scope allows:
- Add toast + alert foundation
- Migrate one dashboard workflow and one storefront/customer workflow as reference implementations

This creates clear examples for subsequent beads and prevents parallel teams from introducing new patterns.
