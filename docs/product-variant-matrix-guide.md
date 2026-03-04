# Product Variant Matrix Guide

## What changed
Products now support structured option dimensions and combination variants, so setups like:
- `Scent`: Unscented, Lavender, Vanilla
- `Size`: 2 oz, 4 oz

can generate 6 variant combinations automatically.

Each variant combination has its own:
- SKU
- Price
- Inventory
- Active/archived state

## Dashboard workflow
1. Go to `Dashboard -> Catalog -> Create product` (or edit an existing product).
2. In `Option Dimensions`:
- Add option name (for example `Scent`, `Size`).
- Add comma-separated values for each dimension.
3. Click `Generate variant combinations`.
4. Review generated variants and adjust SKU, price, inventory as needed.
5. Save the product.

## Validation rules
- Active variant SKUs must be unique.
- If options are being used, duplicate option combinations are not allowed.
- For multi-variant products with structured options, each variant must carry option values.

## Storefront behavior
- Option selectors now follow configured axis/value order.
- Customers select dimension values (for example scent and size), then checkout with the exact variant SKU/price/inventory.

## Notes
- Legacy products without structured options still work.
- Option catalog tables are backfilled from existing variant option data.
