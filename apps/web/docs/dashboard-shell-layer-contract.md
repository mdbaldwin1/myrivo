# Dashboard Shell Layer Contract

## Scope

Dashboard-only layering rules for fixed shell, sticky page headers, sticky table columns, and overlays.

## Contract

1. Sticky page headers must render above all sticky table columns.
2. Sticky table headers render above sticky table body cells.
3. Menus and popovers render above shell and table sticky layers.
4. Dialog/flyout overlays render above menus and popovers.

## Current Layer Values

- Page sticky header (`dashboard-page-header.tsx`): `z-40`
- Sticky table actions header (`product-manager.tsx`): `z-20`
- Sticky table actions cells (`product-manager.tsx`): `z-10`
- Dropdown/select/sheet: `z-50`
- Flyout/dialog overlay: `z-[60]`
- Flyout/dialog content: `z-[61]`

## Verification Targets

1. Catalog page: sticky `Actions` column never overlays page header card.
2. Orders/Billing/Overview: sticky page headers maintain top visual priority.
3. Dropdown/select/flyout/dialog content is never clipped beneath shell layers.
