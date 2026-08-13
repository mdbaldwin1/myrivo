# Task 1 Report: Production Digital Product Domain Contract

## Status

Complete. The shared digital-product manifest, lifecycle, readiness, and validated policy configuration contracts are implemented on `codex/digital-products`. The approved design now records only the four production invariants authorized by the task brief.

## Implementation

- Added immutable `DigitalPurchaseManifest` and `DigitalPurchaseManifestItem` contracts with manifest, order, checkout-session, store, order-item, product, variant, asset, asset-version, filename, MIME, byte-size, checksum, label, sort-order, consent-version, license-version, and created-at fields.
- Added shared digital lifecycle/status types, including `DigitalDeliveryState` and `DigitalProductReadiness`.
- Added `DigitalProductReadinessInput`, using the existing `ProductRecord` product-type/rights fields and existing variant statuses, plus nested asset-version status.
- Implemented `resolveDigitalProductReadiness()` as the structured publish rule engine. It:
  - leaves physical products unchanged;
  - reports all independent failures deterministically;
  - requires rights affirmation and a ready preview;
  - counts only active assets with a non-retired ready version;
  - treats product-wide files as applicable to every active variant;
  - requires each active variant to have an applicable file;
  - ignores archived variants and files scoped only to archived variants.
- Retained `isDigitalProductPublishable()` as a compatibility adapter that delegates its decisions to the new rule engine, preventing a second predicate implementation.
- Replaced the unchecked constant object with a strict Zod-validated `DIGITAL_PRODUCT_CONFIG` containing:
  - access link TTL: 48 hours;
  - private signed storage URL TTL: 300 seconds;
  - five grants per file;
  - 60-second grant reuse grace;
  - 20 active files per product;
  - 250 MiB maximum file size;
  - preview maximum edge: 1400 pixels;
  - preview JPEG quality: 78;
  - JPG/JPEG, PNG, PDF, and ZIP MIME-extension pairs;
  - store-scoped feature flag key: `digitalProducts`;
  - license version: `personal-use-v1`;
  - consent version: `immediate-delivery-v1`.
- Kept the legacy exported license/consent constants as aliases to the validated configuration for existing callers.
- Updated the approved design to state that:
  - immutable manifests are captured before Stripe Checkout Session creation;
  - finalization creates durable delivery jobs;
  - storage-signing failures do not consume grants;
  - rollout is controlled by a store-scoped feature flag that defaults off.

## Files

- `apps/web/lib/digital-products/config.ts`
- `apps/web/lib/digital-products/domain.ts`
- `apps/web/lib/digital-products/types.ts` (new)
- `apps/web/tests/digital-products-domain.test.ts`
- `docs/superpowers/specs/2026-08-12-native-digital-products-design.md`
- `.superpowers/sdd/2026-08-12-digital-products-production-hardening/task-1-report.md` (new)

## TDD Evidence

### RED

Command:

```text
npm test --workspace @myrivo/web -- digital-products-domain.test.ts
```

Observed before production implementation:

```text
Test Files  1 failed (1)
Tests       10 failed | 3 passed (13)
TypeError: resolveDigitalProductReadiness is not a function
Exit code: 1
```

The three legacy tests remained green. All ten new readiness cases failed for the intended reason: the new rule engine did not exist.

### GREEN

Same focused command after implementation:

```text
Test Files  1 passed (1)
Tests       13 passed (13)
Exit code: 0
```

Covered cases: missing rights, missing preview, failed preview, active asset without a ready version, product-wide coverage, missing active-variant coverage, archived variants, complete per-variant coverage, aggregation of independent reasons, and physical-product compatibility.

## Validation

- `npm test --workspace @myrivo/web -- digital-products-domain.test.ts` — 1 file, 13 tests passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm run lint --workspace @myrivo/web` — passed with zero lint warnings/errors; repository feedback and dashboard-route consistency checks passed.
- `npm test --workspace @myrivo/web` — 224 files, 651 tests passed.
- `npm run build --workspace @myrivo/web` — passed; production compilation, TypeScript, page generation, and trace collection completed.
- `git diff --check` — passed.

The full test run emitted pre-existing test-environment stderr from refund/dispute mocks and zero-sized analytics chart containers, but exited successfully with no failed tests. The build emitted the existing Next.js middleware deprecation warning and stale Browserslist data warning, but exited successfully.

## Self-Review

- Requirement coverage: every interface and exact invariant named in the Task 1 brief is present; no schema, route, publishing integration, checkout, delivery worker, access, or UX work from later tasks was implemented.
- Contract consistency: field names use application-style camelCase; IDs and purchase metadata are readonly; manifest items are exposed through a readonly array; nullable `orderId` and `orderItemId` support pre-Stripe capture followed by later lock-to-order behavior.
- Rule consistency: physical products short-circuit as ready; digital reasons use stable machine-readable strings; reason order is deterministic; applicable counts include unique logical assets only when a ready, non-retired version exists.
- Compatibility: current `DigitalAssetCandidate` and `isDigitalProductPublishable()` exports remain available, with the legacy helper now delegating to the sole engine.
- Mutation check: removing rights/preview checks, counting processing or retired versions, excluding product-wide files, including archived variants, skipping a missing variant, returning only one failure, or applying digital rules to physical products would fail at least one new test.
- Scope check: only brief-authorized production/docs/test files plus this required report changed.

## Concerns

- The `bd` executable is not installed in the environment, so `bd prime` and end-of-session `bd sync` could not be run (`zsh: command not found: bd`). The explicitly supplied task brief remained sufficient to execute the task.
- This task centralizes preview/config values but intentionally does not update the prototype preview route's existing `1400`/`78` literals; that route belongs to the later transactional asset/preview lifecycle task. Later work must consume `DIGITAL_PRODUCT_CONFIG.previewMaxEdgePixels` and `previewJpegQuality` when replacing that flow.
