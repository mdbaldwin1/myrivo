# Onboarding Current-State Audit

## Purpose

This document records the current store-creation and onboarding experience as implemented today. It is the baseline for the ideal onboarding redesign initiative and should be treated as a discovery artifact, not a target design.

## Entry Points

### Primary entry

- `Store Hub` exposes `Create Store` from `/dashboard/stores`.
- Current implementation links directly to `/onboarding`.
- Source: `apps/web/app/dashboard/stores/page.tsx`

### Onboarding page

- `/onboarding` is server-rendered.
- If the user is not authenticated, it redirects to `/login`.
- If authenticated, it loads the user's existing onboarding progress and renders a single bootstrap form.
- Source: `apps/web/app/onboarding/page.tsx`

## Current Flow

### Step 1: create store

The current onboarding flow is effectively a one-step bootstrap form:

- asks only for `Store name`
- shows a slug preview (`/s/{slug}`)
- creates the store immediately
- then routes the user into the store workspace

Source:

- `apps/web/components/onboarding/store-bootstrap-form.tsx`

### Step 2: land in workspace

After successful creation:

- the form calls `POST /api/stores/bootstrap`
- on success it pushes to `/dashboard/stores/{slug}`
- it does not route to a storefront preview
- it does not guide the user through a multi-step setup
- it does not generate starter content

Source:

- `apps/web/components/onboarding/store-bootstrap-form.tsx`
- `apps/web/app/api/stores/bootstrap/route.ts`

### Step 3: complete checklist across the workspace

After creation, onboarding becomes a checklist spread across existing workspace destinations:

- `General settings`
- `Storefront Studio`
- `Catalog`
- `Integrations`
- store dashboard / lifecycle actions for launch

Source:

- `apps/web/lib/stores/onboarding.ts`
- `apps/web/lib/stores/onboarding-steps.ts`

## Bootstrap Behavior

### What `/api/stores/bootstrap` does

When a store is created, the bootstrap route:

1. validates `storeName`
2. derives a slug and retries on slug conflicts
3. inserts a `stores` row with:
   - `owner_user_id`
   - `name`
   - `slug`
   - `status = "draft"`
4. upserts:
   - owner membership in `store_memberships`
   - default `store_branding`
   - default `store_settings` with `support_email = user.email`
5. seeds store legal documents
6. sets the active store cookie
7. returns the created store record

Source:

- `apps/web/app/api/stores/bootstrap/route.ts`

### What bootstrap does not do

Bootstrap does not currently:

- ask for logo, description, theme direction, category, audience, or product details
- create starter storefront copy
- create starter theme settings
- create a first product
- connect Stripe
- generate a storefront preview package
- create an onboarding session or resumable wizard state

## Current Onboarding Model

### Progress computation

Onboarding progress is not a wizard-state model today. It is computed from real store data.

The current steps are:

- `profile`
- `branding`
- `firstProduct`
- `payments`
- `launch`

Source:

- `apps/web/lib/stores/onboarding.ts`

### Step completion rules

#### Profile

Marked complete when:

- store name length is at least 2
- `store_settings.support_email` looks populated

#### Branding

Marked complete when:

- `store_branding.primary_color` or `store_branding.accent_color` exists

Important:

- a logo alone does not complete this step

#### First product

Marked complete when:

- at least one product exists for the store

#### Payments

Marked complete when:

- `stores.stripe_account_id` exists

#### Launch

Marked complete when:

- store status is publicly accessible (`live`)

### Launch readiness

The current computed `launchReady` state is:

- `profile && branding && firstProduct && payments`

`launch` itself is not required to be complete to be considered ready to apply.

Source:

- `apps/web/lib/stores/onboarding.ts`

## Current Branch Points

### Existing stores on `/onboarding`

The onboarding page is not only for new store creation. It also renders a list of the user's existing stores, each showing:

- progress summary
- per-step completion status
- next-step CTA
- `Submit for review` if launch-ready and still in `draft`

Source:

- `apps/web/components/onboarding/store-bootstrap-form.tsx`

### Next-step routing

Current next-step routing is:

- `profile` -> `/dashboard/stores/{slug}/store-settings/general`
- `branding` -> `/dashboard/stores/{slug}/storefront-studio?editor=brand`
- `firstProduct` -> `/dashboard/stores/{slug}/catalog`
- `payments` -> `/dashboard/stores/{slug}/store-settings/integrations`
- `launch` -> `/dashboard/stores/{slug}`

Source:

- `apps/web/lib/stores/onboarding-steps.ts`

### Launch status branching

The launch CTA behavior depends on lifecycle status:

- `draft` / `changes_requested` / `rejected`
  - can apply or reapply if launch-ready
- `pending_review`
  - no new launch action
- `live`
  - launch step is complete
- `offline`
  - store is not live, but if it has launched once, the old onboarding surfaces should stay hidden

Source:

- `apps/web/lib/stores/onboarding-steps.ts`
- `apps/web/app/api/stores/onboarding/launch/route.ts`
- `apps/web/components/dashboard/dashboard-header-store-lifecycle-controls.tsx`

## Current Workspace Surfaces Triggered By Onboarding

### Dashboard landing

A newly created store lands on `/dashboard/stores/{slug}`, which is the store dashboard / control tower.

That page is operational, not setup-oriented:

- performance
- order state
- health
- alerts

Source:

- `apps/web/app/dashboard/stores/[storeSlug]/page.tsx`

### Workspace onboarding banner

The store workspace can show an onboarding banner that:

- polls progress every 3.5 seconds
- shows the next step
- is locally dismissible
- hides once `hasLaunchedOnce` is true

Source:

- `apps/web/components/onboarding/store-workspace-onboarding-banner.tsx`
- `apps/web/app/api/stores/onboarding/progress/route.ts`

### Header checklist / lifecycle cluster

The workspace header also has a launch-oriented checklist cluster that:

- summarizes completion state
- links to incomplete steps
- exposes `Go Live` / `Take Offline` / `Apply to Go Live` depending on status

Source:

- `apps/web/components/dashboard/dashboard-header-store-lifecycle-controls.tsx`

### Catalog

The current first-product destination is the full catalog manager.

Characteristics:

- powerful, inventory-aware, full CRUD surface
- uses a heavy `ProductManager`
- built for full product administration, not first-time onboarding simplicity
- includes rich text, images, variants, SEO, merchandising, inventory, status, and more

Source:

- `apps/web/app/dashboard/stores/[storeSlug]/catalog/page.tsx`
- `apps/web/components/dashboard/product-manager.tsx`

### Storefront Studio

Branding today routes into the full Storefront Studio experience:

- multiple surfaces
- multiple editor targets
- preview canvas
- broad storefront editing power

This is strong for refinement, but it is not a guided first-run setup surface.

Source:

- `apps/web/app/dashboard/stores/[storeSlug]/storefront-studio/page.tsx`
- `apps/web/components/dashboard/storefront-studio.tsx`

### Integrations / payments

The current payments step routes to `Integrations`, which contains:

- Stripe Connect status
- connect / continue setup CTA
- Stripe dashboard link
- shipping-provider config on the same page

This is a legitimate operations page, but not a purpose-built onboarding step.

Source:

- `apps/web/app/dashboard/stores/[storeSlug]/store-settings/integrations/page.tsx`
- `apps/web/components/dashboard/store-payments-settings.tsx`

## Current Data Dependencies

The current onboarding system depends on the following persisted data:

### Core store identity

- `stores`
  - `id`
  - `owner_user_id`
  - `name`
  - `slug`
  - `status`
  - `has_launched_once`
  - `stripe_account_id`
  - status reason fields

### Membership and permissions

- `store_memberships`
  - role and active membership

### Profile step

- `store_settings.support_email`

### Branding step

- `store_branding.primary_color`
- `store_branding.accent_color`

### First-product step

- existence of at least one `products` row

### Payments step

- `stores.stripe_account_id`

### Legal baseline

- store legal docs are seeded during bootstrap, but they are not part of launch-readiness computation

### No onboarding-session state

There is currently no first-class persisted onboarding session model for:

- unanswered questions
- draft onboarding answers
- AI generation requests
- resumable wizard progress
- generated storefront package provenance

## Current UX Strengths

- Extremely low friction to create a draft store
- Real data-backed onboarding progress rather than fake completion state
- Clear routing to the operational surfaces that actually matter
- Launch readiness already has a computed model
- Existing stores are visible and resumable from `/onboarding`

## Current UX Weaknesses

### The create-store experience is too thin

Today the user gets:

- one field
- one submit button
- then a jump into a mostly empty workspace

There is no momentum-building setup journey.

### The user is dropped into operations, not inspiration

After creation, the user lands in a store dashboard, not in:

- a preview
- a guided editor
- a generated starter storefront

That means the emotional first impression is operational, not exciting.

### The next steps are scattered

The current flow sends the user across:

- General settings
- Studio
- Catalog
- Integrations
- launch controls

That is functionally correct, but cognitively expensive for a first-time merchant.

### The first product step is too heavy

The current catalog/product manager is powerful but not onboarding-shaped.

For a first-time merchant, it asks them to cross too much complexity too early.

### Branding completion is shallow and slightly misleading

Branding is considered complete when color fields exist. That is useful for launch readiness, but weak as a signal for whether the storefront actually feels polished.

### Payments are late-bound and operational

Stripe connection is appropriately separate, but the current route presents it in an admin/settings shape rather than as the final unlock moment of an onboarding flow.

### No preview-first reveal

There is no “we built your storefront” moment. The product currently asks the merchant to assemble the storefront manually before they see something compelling.

## Implications For The Redesign

This discovery points to a clear product split:

### Keep

- real data-backed launch readiness computation
- existing operational destinations for deeper editing
- Stripe Connect as a real integration step
- Storefront Studio and Catalog as advanced refinement surfaces

### Replace or layer over

- the one-field bootstrap form
- the direct post-create redirect into the control tower
- the need to manually stitch together the first storefront across multiple settings pages
- the current “first product” reliance on the full catalog manager as the onboarding UX

## Summary

The current system is a valid bootstrap + readiness checklist flow, not a true onboarding experience.

It is optimized for:

- creating a store record safely
- routing merchants to existing operational tools
- computing launch readiness from real data

It is not optimized for:

- fast emotional payoff
- guided setup
- minimal decision fatigue
- preview-first activation
- AI-assisted content and theme generation

That distinction should drive the next beads: we should preserve the readiness model, but replace the front-door experience entirely.
