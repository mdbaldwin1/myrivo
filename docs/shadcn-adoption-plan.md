# Shadcn Adoption Review and Plan

## Current State

### What is already aligned
- Core primitives are in place and close to shadcn patterns:
  - `Button`, `Card`, `Input`, `Textarea`, `Badge`, `Separator`, `Table`
- New flyout/sheet interactions now use shadcn-style `Sheet` primitives.
- Dashboard create/edit surfaces are mostly moving toward consistent panel-based UX.

### What is partially aligned
- `Select` and `Checkbox` are currently native wrappers, not Radix-based shadcn components.
- Several app-specific wrappers (`SectionCard`, `FormField`, `RowActions`, `DataStat`, `StatusChip`) are useful, but duplicate style logic and create drift from standard shadcn composition.
- Many dashboard surfaces still use repeated inline utility strings like `rounded-md border border-border bg-white p-3` instead of shared components.

### What is not aligned
- No standard shadcn `Dialog`, `Popover`, `DropdownMenu`, `Tooltip`, `Tabs`, `Switch`, `Form` stack in current UI primitives.
- Form state/validation patterns are ad hoc (`useState` + manual validation everywhere) rather than shadcn + RHF + zod resolver patterns.
- Token usage is inconsistent between `bg-card` and hardcoded `bg-white` in dashboard internals.

## Migration Completed in This Pass
- Added shadcn-style `Sheet` primitive:
  - `apps/web/components/ui/sheet.tsx`
- Converted all flyouts to run on top of shadcn `Sheet` through existing `Flyout` API:
  - `apps/web/components/ui/flyout.tsx`
- Added `tailwindcss-animate` plugin required by shadcn animation classes:
  - `apps/web/tailwind.config.ts`
- Added required dependency:
  - `@radix-ui/react-dialog`

## Gaps to Address Next

1. Primitive parity with shadcn baseline
- Add and standardize these components in `components/ui`:
  - `dialog`, `popover`, `dropdown-menu`, `tooltip`, `tabs`, `switch`, `radio-group`, `label` cleanup parity.
- Replace custom modal/panel patterns to use the standardized primitives.

2. Form architecture standardization
- Introduce `react-hook-form` + `@hookform/resolvers/zod` + shadcn `Form` primitives.
- Convert highest-change forms first:
  - `store-policies-form`, `branding-settings-form`, `product-manager` create/edit flows, `orders` ship flow.
- Consolidate validation logic in shared zod schemas per feature (client + API reuse where feasible).

3. Visual token consistency
- Replace repeated `bg-white` blocks in dashboard with tokenized surfaces (`bg-card`, `bg-background`, or dedicated sub-surface component).
- Create reusable panel atoms to eliminate repeated class strings:
  - e.g. `SettingsSummaryPanel`, `InfoPanel`, `InlineStatRow`.

4. Composition and reuse cleanup
- Reduce one-off abstractions where shadcn primitive composition is enough.
- Keep wrappers only when they encode stable business semantics.

5. Interaction consistency
- Standardize all edit/create entry points:
  - list/detail summary card + flyout/sheet edit pattern (already underway).
- Keep high-frequency operational controls inline where speed matters (orders status updates).

6. Accessibility and QA hardening
- Ensure all interactive fields have labels/descriptions.
- Add focus/keyboard checks for sheets/dialogs and destructive actions.
- Add Playwright smoke checks for key flows: product edit, content block edit, shipping config.

## Suggested Execution Plan (Beads)

### Bead 1: Primitive Baseline
- Add missing shadcn primitives (`dialog`, `popover`, `dropdown-menu`, `tooltip`, `tabs`, `switch`).
- No feature changes; only add primitives and verify imports.

Acceptance:
- New primitives compile and pass lint/typecheck.

### Bead 2: Form Foundation
- Add RHF/resolver deps and create shared `form.tsx` primitives.
- Convert `Store Settings` and `Store Policies` forms first.

Acceptance:
- No behavior regression; validations preserved.

### Bead 3: Catalog + Promotions Forms
- Convert product create/edit and promotions flows to RHF + zod schemas.
- Normalize helper text and field labeling.

Acceptance:
- Existing create/edit behavior unchanged; tests pass.

### Bead 4: Orders + Shipping Controls
- Convert shipping/edit panels to standard form stack.
- Keep inline order status changes for speed.

Acceptance:
- Shipment flows and tracking sync behavior unchanged.

### Bead 5: Surface Token Cleanup
- Replace remaining hardcoded white surfaces with tokenized component surfaces.
- Introduce reusable panel atoms to remove repeated utility clusters.

Acceptance:
- Visual parity maintained while classes become more consistent.

### Bead 6: Accessibility + E2E Backstop
- Add E2E coverage for all major dashboard edit surfaces.
- Add keyboard/focus assertions around sheets/dialogs.

Acceptance:
- Stable smoke coverage for production-critical editing paths.

## Verification Standard
- For each bead:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
- For interaction-heavy beads:
  - targeted `npm run e2e` specs for changed flows.

