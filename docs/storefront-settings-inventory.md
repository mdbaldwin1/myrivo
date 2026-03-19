# Storefront Settings Inventory

This document is the human-readable companion to the canonical registry at:

- `/Users/mbaldwin/Myrivo/myrivo/apps/web/lib/storefront/settings-inventory.ts`

It exists to keep the storefront settings migration honest: every persisted storefront-facing setting must have exactly one intentional home.

## Intentional Homes

### Store Settings > General
Use for identity, search, and browser/sharing metadata:

- store name
- white-label enablement
- favicon
- apple touch icon
- Open Graph image
- Twitter image
- SEO title
- SEO description
- noindex
- local SEO location fields

### Store Settings > Domains
Use for domain operations only:

- custom domains
- verification
- primary domain selection

### Storefront Studio
Use for storefront presentation, layout, behavior, and customer-facing copy:

- logo in storefront context
- colors and visual theme
- typography
- spacing
- radius
- card style
- header/footer layout
- announcement bar presentation
- home/catalog/product-detail visual controls
- review display behavior
- newsletter/footer/about/policies storefront copy
- checkout presentation labels and prompts

### Store Settings > Legal
Use for formal legal/compliance-owned storefront documents:

- formal legal documents

### Store Settings > Privacy
Use for store-specific privacy operations:

- privacy contact identity
- privacy request page intro
- California and do-not-sell/share addenda
- privacy request handling

## Current Stranded Settings

These fields are persisted and used at runtime, but do not currently have a complete active editing home:

- none currently identified in the browser/share asset set

These are only partially surfaced and need clearer or fuller active homes:

- none currently identified in the Home / Products / Product Detail Studio controls

## Active Studio Controls Confirmed

These settings are already editable in the active Storefront Studio experience and should not be treated as stranded:

- `theme_json.homeFeaturedProductsLimit` via `Storefront Studio > Home`
- `theme_json.productGridColumns` via `Storefront Studio > Products`
- `theme_json.productsFilterLayout` via `Storefront Studio > Products`
- `theme_json.productCardDescriptionLines` via `Storefront Studio > Products`
- `theme_json.productCardImageFit` via `Storefront Studio > Products`
- `theme_json.heroBrandDisplay` via `Storefront Studio > Home`
- `theme_json.reviewsDefaultSort` via `Storefront Studio > Product Detail`
- `theme_json.reviewsItemsPerPage` via `Storefront Studio > Product Detail`
- `theme_json.reviewsFormEnabled` via `Storefront Studio > Product Detail`

## Legacy / Decision Fields

These fields have now been resolved as retired from the active merchant-facing settings model:

- `theme_json.buttonStyle`
- `theme_json.fontPreset`

`fontPreset` is still honored as a compatibility fallback when older theme payloads are resolved, but it no longer belongs in the active editable storefront contract.

## Migration Rule

Before removing any legacy settings surface, confirm that every field it covers is:

1. editable from an active surface,
2. persisted through the active save path,
3. represented in the inventory registry,
4. covered by completeness regression tests.
