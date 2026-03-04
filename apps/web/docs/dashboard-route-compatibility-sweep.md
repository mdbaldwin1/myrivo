# Dashboard Route Compatibility Sweep (`myrivo-4.8`)

## Scope

Fixed-shell compatibility review for dashboard routes:

- Overview
- Catalog
- Orders
- Billing
- Platform
- Store Settings
- Content Studio

## Findings and Fixes

1. Resolved runtime warning affecting dashboard forms:
   - Warning: `Invalid prop style supplied to React.Fragment`
   - Source: custom `Select` primitive used `asChild` rendering paths that can forward style props through Radix slotting.
   - Fix: removed `asChild` usage in `SelectPrimitive.Value` and `SelectPrimitive.Icon` and switched to direct primitive rendering.

2. Sticky layering compatibility:
   - Verified contract from `myrivo-4.6` remains in place for catalog action columns vs page headers.
   - Canonical layer values remain documented in `dashboard-shell-layer-contract.md`.

3. Responsive shell compatibility:
   - Verified `myrivo-4.7` mobile drawer fallback and desktop sidebar split applies consistently across all dashboard routes under `/dashboard/*`.

## Verification

- `npm run lint`
- `npm run typecheck`
