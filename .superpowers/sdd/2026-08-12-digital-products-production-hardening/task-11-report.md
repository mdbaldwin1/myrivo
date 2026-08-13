# Task 11 Report: Rebuild the Merchant Catalog UX

## Status

Complete on `codex/digital-products`. The merchant catalog now gives digital products a fulfillment-first, readiness-led workflow across Overview, Variants, Files, and Media while preserving the physical product inventory experience.

## Implementation

### Catalog and inspector

- Replaced the physical-only inventory catalog column with an explicit Fulfillment column and clear `Digital download` / `Physical` labels.
- Added semantic, keyboard-native product tabs. Digital products use Overview, Variants, Files, and Media; physical products retain Overview, Variants, Inventory, and Media.
- Kept inventory adjustment available for physical products and removed inventory and made-to-order concepts from digital rows, variants, and forms.
- Forced digital variant inventory and made-to-order values to their neutral server payload values even if a merchant converts an existing physical product.

### Readiness-led digital workflow

- Added an Overview with fulfillment type, price, applicable file coverage, public preview status, fixed 48-hour access, five-download grant policy, and the standard personal-use license.
- Added a compact publish-readiness checklist whose actions open the rights control or the exact Files/Media repair target. Publishing stays disabled until the authoritative readiness contract reports ready.
- Rights consent is cleared whenever fulfillment type changes, preventing stale physical-to-digital conversion consent. The editor explains that customer files are attached after a draft exists.
- Newly created digital drafts are selected automatically and handed off to Files.

### File management

- Rebuilt Files as a responsive, accessible multi-file surface with independent announced upload phases, native progress semantics, validation from centralized file limits, safe empty/loading/error states, and focused error recovery.
- Added customer-facing labels, immutable filename/type/size/version metadata, status badges, all-variant or variant-specific availability, and an accessible actions menu.
- Added rename, variant assignment, optimistic keyboard-native reorder with rollback, confirmed replacement, and confirmed removal. Replacement and removal copy explicitly preserves purchased versions.
- Failed uploads retry through the existing upload-intent lifecycle; partial completion responses reconcile against authoritative asset state before showing failure.

### Media and public preview safety

- Separated storefront images, private customer deliverables, and the exact buyer-visible public preview.
- Merchants can choose a storefront image as the preview override and retry a failed automatic preview through the existing preview lifecycle.
- Shared server-side catalog enrichment loads readiness plus preview state for both SSR and `/api/products` refreshes. Only a resolved public preview URL is returned; private preview storage paths and original deliverable paths are not exposed.

## TDD Evidence

### RED

- The initial Files journey tests failed against the single-file prototype because multi-upload progress, metadata, variant assignment, optimistic rollback, confirmations, and retry behavior did not exist.
- Catalog integration tests failed while the inventory column and universal inventory tab remained, digital forms exposed physical stock controls, tabs lacked semantics, stale rights survived conversions, and Overview/Media components did not exist.
- Server-state coverage failed before catalog readiness/public-preview enrichment existed.

### GREEN

Focused Task 11 evidence:

```text
Test Files 2 passed (2)
Tests 10 passed (10)
```

Coverage includes multi-upload/progress, intent retry, rename, scope assignment, optimistic reorder rollback and focus, replacement/removal preservation copy, readiness deep links, preview override/retry, digital/physical catalog regression behavior, stale-rights conversion, and non-disclosure of private preview paths.

## Validation

- `npm run lint` — passed with zero warnings/errors; feedback and dashboard-route consistency checks passed.
- `npm run typecheck` — passed.
- `npm test` — 248 files and 972 tests passed.
- `npm run build` — passed; production compilation, TypeScript, all 161 static pages, optimization, and trace collection completed.
- `git diff --check` — passed.

The full suite retained pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing middleware deprecation and stale Browserslist-data warnings.

## Principal Files

- `apps/web/components/dashboard/product-manager.tsx`
- `apps/web/components/dashboard/product-manager-domain.ts`
- `apps/web/components/dashboard/digital-product-overview.tsx` (new)
- `apps/web/components/dashboard/digital-publish-readiness.tsx` (new)
- `apps/web/components/dashboard/digital-product-files.tsx`
- `apps/web/components/dashboard/digital-product-file-row.tsx` (new)
- `apps/web/components/dashboard/digital-preview-manager.tsx` (new)
- `apps/web/lib/digital-products/catalog-state.ts` (new)
- `apps/web/app/api/products/route.ts`
- `apps/web/app/dashboard/stores/[storeSlug]/catalog/page.tsx`
- `apps/web/tests/digital-product-files.test.tsx` (new)
- `apps/web/tests/digital-product-catalog-ux.test.tsx` (new)
- `CHANGELOG.md`

## Handoff

- Browser verification remains the parent task's integrated end-to-end checkpoint; component tests cover the full merchant interaction contract and accessibility semantics.
- Preview and asset mutations use only the established Task 3 lifecycle APIs. Catalog enrichment is read-only and deliberately exposes public preview URLs instead of storage paths.
