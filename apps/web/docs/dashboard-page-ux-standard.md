# Dashboard Page UX Standard

## Purpose

Define one cohesive interaction model for dashboard pages so layout, editing, and actions behave consistently.

## Shell and Scrolling

1. Fixed shell only at app level:
   - top header fixed by shell
   - sidebar fixed by shell
2. Main content pane owns vertical scrolling.
3. Page-local headers are **not sticky by default**.
4. Sticky page elements are reserved for:
   - data-grid table headers/columns
   - dirty-state action bars on long forms

## Page Structure

1. Top page intro (`DashboardPageHeader`):
   - title + concise description
   - optional contextual action (not primary form save)
2. Content sections:
   - section cards with clear title + helper text
   - avoid deeply nested cards
3. Action placement:
   - forms: bottom sticky action bar (`Discard`, `Save`)
   - data management: top-right create/filter actions, row-level actions inline

## Save and Discard Behavior

1. Settings pages use deferred save with explicit save/discard controls.
2. Save/discard controls live in a bottom sticky action bar (`DashboardFormActionBar`).
3. Header-level save/discard buttons are avoided for consistency and reduced cognitive load.
4. Immediate-save interactions are allowed only for:
   - fast row-level toggles/selects in operational lists
   - low-risk status updates with instant feedback

## Flyouts, Modals, and Full Pages

1. Use flyout for constrained edit/create tasks:
   - limited fields
   - no deep dependencies
2. Use modal for confirmation or short single-purpose actions.
3. Use full page for high-complexity or multi-section workflows.
4. Do not put mission-critical multi-step flows inside flyouts.

## Implementation Status (This Pass)

Applied:

1. `DashboardPageHeader` made non-sticky by default.
2. Added reusable `DashboardFormActionBar`.
3. Applied bottom action bar pattern to:
   - `Store Settings > Profile`
   - `Store Settings > Branding`
   - `Store Settings > Checkout Rules`
4. Applied bottom action bar pattern to:
   - `Account Settings`
   - `Content Workspace` dedicated section forms
5. Applied bottom action bar pattern to:
   - `Platform Controls`
   - `Hero Content` form

Next rollout targets:

1. Any remaining forms using local ad-hoc save/discard bars
2. Normalize flyout usage against the standard criteria
3. Add lightweight UX checklist to PR template for dashboard page work
