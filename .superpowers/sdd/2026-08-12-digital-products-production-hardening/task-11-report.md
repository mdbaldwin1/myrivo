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

## Fix 1: Authoritative Readiness, Async Isolation, and Inventory Invariants

### Reviewed corrections

- Centralized catalog re-enrichment in one generation-safe refresh path. Successful digital rights, file, and preview mutations now reload the authoritative `/api/products` readiness/preview projection; publishing performs its own fresh read and fails closed instead of trusting a stale enabled button.
- Keyed Files and Media by product identity and added explicit reset, abort, unmount, and stale-completion guards. Product changes clear assets, persisted failures, upload jobs, busy state, errors, confirmations, scope, preview state, and pending requests; a completion originating from product A cannot mutate product B or invoke B's catalog callback.
- Extended the safe Files GET contract with failed lifecycle intents, excluding storage paths. Reloaded failures explain their safe error, distinguish private-file upload retry from buyer-preview processing, require the merchant to reselect the exact declared filename/MIME/size, and resume through the existing retry-intent, signed PUT, and completion lifecycle. Failed previews continue through the separate preview retry endpoint.
- Made two-tier create/edit instructions and option summaries fulfillment-aware. Digital products no longer mention inventory or render `Inv 0`; physical copy and inventory behavior remain unchanged.
- Normalized digital inventory at both boundaries: POST/PATCH route payloads force product/variant quantity to zero and made-to-order off, while forward migration `20260813015000_enforce_digital_inventory_invariants.sql` backfills existing rows and adds product/variant trigger defenses. The database normalizes direct writes, existing digital RPC writes, and physical-to-digital conversion even if a stale or hostile client submits stock values.

### Fix 1 TDD evidence

RED evidence reproduced all five review findings:

- Focused application tests failed in nine intended places: stale rights/media readiness, stale publish authorization, preview and upload completion after product switch, missing persisted failed-intent recovery, physical copy in digital two-tier variants, and unnormalized POST/PATCH inventory fields.
- The native PostgreSQL regression failed before the forward migration could normalize hostile catalog-RPC and direct database writes.

GREEN evidence after the corrections:

```text
Focused catalog/files/routes: 4 files, 21 tests passed
Native PostgreSQL migration suite: 87 tests passed
Full repository suite: 249 files, 982 tests passed
```

Fresh Fix 1 gates:

- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors; feedback and dashboard-route consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test` — 249 files and 982 tests passed.
- `npm run build` — passed; production compilation, TypeScript, all 161 static pages, optimization, and trace collection completed.
- `git diff --check` — passed.

The full suite retained the pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing middleware deprecation and stale Browserslist-data warnings.

## Fix 2: Active Files Lifecycle Cancellation

- Added one tracked `AbortController` per Files operation. The signal spans upload-intent creation, signed object PUT, completion, in-session and persisted retry, replacement, rename/assignment, reorder, removal, asset reload, and the parent catalog refresh.
- Product identity changes and unmounts now abort and clear every active controller, so network/storage work for the previous product stops instead of merely being ignored after it finishes. Abort errors are intentionally silent: they do not create a failed upload, show an alert, call the catalog callback, or advance into later lifecycle stages. Any already-created intent/object remains covered by the existing expiry/orphan cleanup contract.
- Confirmed Media already owns an `AbortController` for both preview mutation paths and aborts its controller set on product change/unmount; no Media change was required in this round.

### Fix 2 TDD evidence

The strengthened product-switch regression first failed because the deferred signed PUT received no signal (`uploadSignal?.aborted` was undefined). It now deterministically waits until the PUT begins, switches from product A to B, observes `signal.aborted === true`, and verifies completion, callback, stale upload state, and error UI never occur.

Fresh Fix 2 gates:

- Focused Files/Catalog UX: 2 files and 16 tests passed.
- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors and both consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test` — 249 files and 982 tests passed.
- `npm run build` — passed; all 161 static pages generated.
- `git diff --check` — passed.

The full suite retained the pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing middleware deprecation and stale Browserslist-data warnings.

## Fix 3: Post-response Catalog Cancellation

- Hardened the authoritative catalog refresh across every asynchronous boundary. It now checks the caller's abort signal immediately after fetch resolution, after JSON body parsing, and immediately before error or product-state commits, while retaining the latest-generation guard for competing live refreshes.
- Extended Media's existing operation signal through its catalog-refresh callback. A preview mutation and its authoritative readiness reload now share one cancellation lifetime, matching Files; switching products or unmounting aborts both stages.
- Audited the other Task 11 JSON pipelines. Files and Media already combine tracked controller cleanup with product-identity checks after body parsing and before local state/callback work. The only callback gap was Media's previously unscoped parent refresh, corrected here.

### Fix 3 TDD evidence

Two deterministic deferred-body regressions were added at the ProductManager boundary:

- Files: fetch resolves for product A while `response.json()` remains pending; switching to B aborts the Files signal, then resolving A's body must not replace B with stale catalog data or show an error. Before the fix, the test failed with `Stale product A` committed to the catalog.
- Media: the preview mutation starts a parent catalog refresh whose body remains pending; switching to B aborts Media's controller, then resolving A's body must not commit stale data or show an error. Before the fix, the test failed because the catalog refresh received no signal.

Fresh Fix 3 gates:

- Focused Files/Catalog UX: 2 files and 18 tests passed.
- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors and both consistency checks passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm test` — 249 files and 984 tests passed.
- `npm run build` — passed; all 161 static pages generated.
- `git diff --check` — passed.

The full suite retained the pre-existing refund/dispute mock stderr and zero-size chart warnings. The build retained the existing middleware deprecation and stale Browserslist-data warnings.
