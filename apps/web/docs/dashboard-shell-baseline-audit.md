# Dashboard Shell Baseline Audit

## Scope

Baseline captured before `myrivo-4.2` shell refactor.

Audited files:

- `apps/web/app/dashboard/layout.tsx`
- `apps/web/components/dashboard/dashboard-nav.tsx`
- `apps/web/components/dashboard/dashboard-page-header.tsx`
- dashboard pages/components with sticky/fixed layers and table sticky columns

## Current Layout Baseline

1. Dashboard renders inside `PageShell` with normal document scroll.
2. Top store header is part of page flow, not globally fixed.
3. Left nav uses `lg:sticky lg:top-6`, but page scroll is still document-based.
4. Main content scroll ownership is implicit (browser window/document).
5. Page-level sticky headers use `window` scroll listeners.

## Sticky/Fixed Layer Inventory (Current)

### Shell and Navigation

- `dashboard-nav.tsx`: `nav` has `lg:sticky lg:top-6`.
- `dashboard-page-header.tsx`: sticky page header (`sticky top-6 z-20`) with shadow-on-stick logic from `window` listeners.

### Table Sticky Columns

- `product-manager.tsx`:
  - sticky actions header `z-30`
  - sticky action cells `z-20`, `z-10`

### Overlays and Popovers

- Dropdown menus and selects:
  - `z-50`
- Flyout modal layers:
  - overlay `z-[60]`
  - content `z-[61]`
- Sheet overlay/content:
  - `z-50`

## Known Risks Before Refactor

1. Sticky detection coupled to `window` may break once main content becomes container-scrolled.
2. Sticky table action columns can overlap page headers if z-index contract is not explicit.
3. Mixed scroll ownership can cause dual-scroll traps on smaller viewports.
4. Dropdown/overlay layering can regress when shell introduces new stacking contexts.

## Guardrails

1. Define single scroll owner for dashboard route content.
2. Keep sidebar and main content scroll regions explicit and independent.
3. Standardize layer contract:
   - shell header > page sticky header > sticky table columns
   - overlays/popovers above all shell layers
4. Verify mobile fallback avoids fixed-height traps and preserves usable navigation.

## Acceptance Matrix (Migration Done Criteria)

1. Header remains visible while navigating and scrolling content.
2. Sidebar remains fixed; only center nav section scrolls.
3. Main content pane scrolls independently with no document-scroll bleed.
4. Sticky page headers and sticky table columns no longer overlap incorrectly.
5. Dropdowns/flyouts/modals render above shell layers.
6. Dashboard routes are validated:
   - Overview
   - Catalog
   - Orders
   - Billing
   - Platform
   - Store Settings
   - Content Workspace
7. Keyboard navigation and focus visibility remain correct.

## QA Checklist Template

Run this for each shell bead affecting layout:

1. Desktop (>= 1280px): header fixed, sidebar fixed, only main content scrolls.
2. Desktop: sidebar center scroll works independently with long nav.
3. Catalog: sticky action columns do not overlap sticky page header.
4. Orders/Billing: sticky page headers animate shadow correctly when stuck.
5. Overlay tests:
   - dropdown menu
   - select menu
   - flyout/dialog
6. Mobile/Tablet:
   - no trapped scroll
   - nav still reachable
   - content remains readable and actionable
