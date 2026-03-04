# Dashboard Shell Migration Plan

## Objective

Migrate dashboard UX to a fixed-shell model with desktop-app feel:

- fixed top header
- fixed left sidebar
- independent scrolling in sidebar center area and main content pane
- no dashboard body/document scroll bleed

## Bead Map

1. `myrivo-4.1` Baseline audit and migration guardrails
2. `myrivo-4.2` Dashboard shell container refactor
3. `myrivo-4.3` Fixed top header migration
4. `myrivo-4.4` Sidebar fixed-column and segmented scrolling
5. `myrivo-4.5` Main content pane scroll migration
6. `myrivo-4.6` Layering and z-index contract enforcement
7. `myrivo-4.7` Responsive fallback shell behavior
8. `myrivo-4.8` Dashboard route compatibility sweep
9. `myrivo-4.9` Accessibility and keyboard behavior hardening
10. `myrivo-4.10` Automated regression coverage for shell
11. `myrivo-4.11` Rollout and verification closeout

## Architecture End State

- Shell owns viewport (`h-screen`) and overflow boundary (`overflow-hidden`).
- Header remains persistent at top of shell.
- Sidebar remains persistent in left column.
- Sidebar center section scrolls independently of main content.
- Main content pane is the primary route content scroll container.
- Page-level sticky headers stick within main content pane.

## Validation Gates

Each bead must run, at minimum:

- `npm run lint`
- `npm run typecheck`
- Focused tests for touched behavior (unit/integration/e2e where applicable)

Additional gates for shell beads (`4.2`-`4.8`):

- manual QA in desktop + tablet + mobile breakpoints
- verify no dual-scroll in dashboard routes
- verify sticky headers do not overlap with sticky table columns

## Rollback and Safety

- Migrate incrementally by bead in isolated `codex/*` worktree branches.
- Keep each bead narrowly scoped and PR-reviewed.
- Avoid schema-destructive changes in shell beads.
- Preserve route behavior parity while changing layout mechanics.
