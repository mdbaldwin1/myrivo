# Task 2 Report: Relationally Safe, Upgrade-Safe Digital Product Schema

## Status

Complete on `codex/digital-products`. The prototype migration remains unchanged and a forward-only hardening migration now enforces tenant/parent relationships, immutable purchase snapshots, durable delivery work, reserve/commit/release download accounting, private-original/public-preview storage policy boundaries, and orphan-upload cleanup metadata.

## Migration Status Evidence and Decision

The required deployment-status investigation found:

- `20260812170000_native_digital_products.sql` was introduced in feature commit `4bca02f` and subsequently amended in `5d51c85` and `dc89d5a`.
- `git branch -r --contains dc89d5a` returned no remote branches. The feature history is not present on the fetched `origin/develop` or `origin/main` refs.
- `supabase status` and `supabase migration list --local` could not inspect a local migration ledger because the local stack is stopped and Docker is unavailable.
- `supabase migration list --linked` reported that no project reference is linked in this worktree.
- No checked-in Supabase link metadata or other repository evidence proves preview/production migration history.

This is evidence that the prototype is feature-branch-only in the fetched Git history, but it is not proof that no shared environment ever ran one of its revisions. Following the brief's safe assumption, `20260812170000` was preserved byte-for-byte and all hardening was implemented in new forward-only migration `20260812180000_harden_digital_products.sql`.

## Implementation

### Relational integrity

- Added composite uniqueness for commerce parents and digital children, including `(id, store_id)` and `(id, product_id, store_id)` identities.
- Added/strengthened composite foreign keys for:
  - product-to-store;
  - variant-to-product/store;
  - order-item-to-order/product/variant/store;
  - checkout-session-to-order/store;
  - asset-to-product/variant/store;
  - version-to-asset/product/store;
  - preview-to-product/source-asset/source-version/store;
  - entitlement-to-order/item/product/variant/asset/version/store;
  - access-token and download-grant order/store identity;
  - manifest/item order/product/variant/asset/version identity;
  - delivery attempt-to-job/order/store identity.
- Backfilled the added relational columns for valid prototype rows before making them non-null and applying constraints.
- Added compatibility triggers that derive new relationship columns for legacy insert shapes. A caller cannot override these derived values to create a mismatch.
- Added checks for hashes, bounded strings and safe errors, status lifecycles, timestamps, byte sizes, positive/nonnegative counts, and sort/attempt ordering.

### Immutable purchase manifests

- Added `digital_purchase_manifests`, unique by non-null checkout session and non-null order, with `draft|locked` lifecycle and consent/license snapshots.
- Added `digital_purchase_manifest_items` containing exact order-item/product/variant/asset/version plus customer filename, MIME, byte size, SHA-256 checksum, label, and sort-order snapshots.
- Locked manifests reject update/delete, and locked manifest items reject insert/update/delete.
- Lock transition requires at least one child and requires every child to be associated with the same order/store and an order item.
- Added the service-role-only `admin_repair_digital_purchase_manifest_item` function. It uses a narrowly scoped definer/transaction repair flag and writes old/new row JSON plus the bounded reason into the RLS-protected `digital_manifest_repair_audit` table.

### Durable delivery

- Added `digital_delivery_jobs` with unique `(order_id, job_type)`, `pending|processing|succeeded|failed`, nonnegative attempt count, next-attempt time, processing lease, bounded last safe error, and lifecycle/timestamp checks.
- Added `digital_delivery_attempts` with positive attempt number and `processing|succeeded|failed` lifecycle.
- Job/attempt columns intentionally contain no bearer token, token hash, private storage path, signed URL, or equivalent secret material.

### Download reserve/commit/release

- Migrated legacy grants into explicit `reserved|issued|released|failed` state with reservation expiry, issue grace expiry, release/failure timestamps, bounded safe errors, and a stable 64-character client/session fingerprint hash.
- Replaced the prototype RPC with service-role-only functions:
  - `reserve_digital_download_grant` creates or reuses a reservation without incrementing usage and returns only an asset-version identifier plus safe metadata;
  - `commit_digital_download_grant` atomically increments `download_grants_used` once and marks the grant issued;
  - `release_digital_download_grant` releases an uncommitted reservation without incrementing usage.
- The reservation quota includes active, unexpired reservations to prevent concurrent oversubscription.

### Storage safety and cleanup

- Reasserted the originals bucket as private and the previews bucket as public with their bounded MIME/size settings.
- Added an explicit restrictive original-object read policy for anonymous/authenticated actors and a permissive public-read policy limited to the preview bucket.
- Added `upload_completed_at`, `orphan_cleanup_after`, and `orphaned_at` metadata with lifecycle checks and a trigger that defaults unfinished uploads to a 24-hour cleanup window.

### Type updates

- Updated the repository's hand-maintained `apps/web/types/database.ts` record contracts for the added relational fields, preview, access-token, grant, manifest, audit, delivery job/attempt, and reservation result records/statuses.
- The repository does not currently expose generated Supabase `Database` tables/functions in that file; it uses record interfaces. Those interfaces were updated directly and validated by TypeScript because Docker-backed local CLI generation was unavailable.

## Files

- `supabase/migrations/20260812180000_harden_digital_products.sql` (new)
- `apps/web/tests/digital-products-migration.test.ts` (new)
- `apps/web/types/database.ts`
- `.superpowers/sdd/2026-08-12-digital-products-production-hardening/task-2-report.md` (new)

`supabase/migrations/20260812170000_native_digital_products.sql` was intentionally not modified.

## TDD Evidence

### Initial RED

Command, before creating the hardening migration:

```text
npm test --workspace @myrivo/web -- digital-products-migration.test.ts
```

Observed:

```text
Test Files  1 failed (1)
Tests       11 skipped (11)
Error: Missing hardening migration: .../20260812180000_harden_digital_products.sql
Exit code: 1
```

The executable contract suite existed first and failed for the intended reason: the production migration did not exist.

### Additional RED/green cycles from self-review

- Added a lock-transition contract: it failed because a manifest containing an orderless child could become locked (`1 failed | 11 passed`), then passed after the trigger enforced complete order association.
- Added legacy-insert compatibility contracts: the first failed with `null value in column "store_id" of relation "order_items"`, then passed after relationship-derivation triggers were added.
- Added null-sensitive preview/safe-error contracts: both initially failed because PostgreSQL `CHECK` accepts a null result (`2 failed | 13 passed`), then passed after the checks used explicit null-safe length comparisons.

### Final GREEN

Focused command:

```text
npm test --workspace @myrivo/web -- digital-products-migration.test.ts
Test Files  1 passed (1)
Tests       16 passed (16)
Exit code: 0
```

The test launches PostgreSQL 17, applies:

- the prototype plus hardening migration to an empty fresh fixture;
- the prototype, valid legacy rows, then the hardening migration to an upgrade fixture;
- the complete repository migration chain to a Supabase-foundation-compatible fixture.

It then executes real inserts/updates/RPCs and asserts rejection or durable state, rather than grepping migration source.

## Validation

- Complete native PostgreSQL 17 repository migration replay — passed, producing 78 public tables.
- `npm test --workspace @myrivo/web -- digital-products-migration.test.ts` — 1 file, 16 tests passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm run lint --workspace @myrivo/web` — passed with zero ESLint warnings/errors; feedback/dashboard consistency checks passed.
- `npm test --workspace @myrivo/web` — 225 files, 669 tests passed.
- `npm run build --workspace @myrivo/web` — passed, including production compilation, TypeScript, 156-page generation, optimization, and trace collection.
- `git diff --check` — passed.

The full test suite emitted the existing refund/dispute mock stderr and zero-size analytics chart warnings while exiting successfully. The build emitted the existing middleware deprecation and stale Browserslist-data warnings while exiting successfully.

### Supabase CLI limitation and bounded alternative

`supabase db reset` and `supabase gen types typescript --local` were both attempted and failed before database work because Docker Desktop was unavailable:

```text
failed to inspect service: Cannot connect to the Docker daemon ...
Docker Desktop is a prerequisite for local development.
```

The bounded alternative uses installed native PostgreSQL 17, matching `supabase/config.toml`'s `major_version = 17`, and executes the entire migration chain plus both fresh/upgrade behavioral fixtures. No shared environment was mutated.

## Self-Review

- Upgrade safety: the prototype migration is untouched; valid prototype rows are backfilled and preserved; legacy issued grants retain issued state/timestamp; legacy insert payloads continue to work through derived columns.
- Tenant safety: every relevant relationship carries store plus parent identity; mutations that mix stores, products, variants, orders, items, assets, or versions are rejected by PostgreSQL.
- Snapshot safety: locked manifest rows and children are immutable; lock requires complete association; the only repair path is service-role-only and audited.
- Counter safety: reserve does not consume; commit is idempotent and consumes exactly once; release does not consume; active reservations participate in quota checks.
- Secret safety: no delivery job/attempt or reserve result stores/returns bearer tokens, token hashes, private object paths, or signed URLs.
- Storage safety: the original bucket is forced private; public policy is limited to previews; abandoned-upload expiration is recorded.
- Scope: no checkout, delivery-worker, application access, dashboard, or upload service from later tasks was implemented.
- Mutation check: removing each composite FK family, allowing incomplete lock, changing reserve to increment, permitting failed state without a safe error, permitting ready preview without a path, adding secret delivery columns, or removing the storage policies would fail at least one focused contract.

## Concerns

- Docker is unavailable, so the official Supabase reset and local type-generation commands could not run. Native PostgreSQL 17 fresh/upgrade/full-chain execution provides bounded schema evidence, but the Docker-backed Supabase stack should still be reset in CI or by a release operator before deployment.
- No linked project or remote migration ledger was available. The forward-only decision is deliberately conservative; release operations must compare `20260812170000` and `20260812180000` against preview/production ledgers before applying.
- `bd` is not installed in the environment, so `bd prime` and `bd sync` could not be run.

## Fix Round 1: Hardened Download Route Compatibility

### Review finding

The hardening migration correctly removed the unsafe three-argument `reserve_digital_download_grant` function, but the existing server route still called that signature and expected the prototype RPC to return `storage_path`. Applying the migration before later access tasks would therefore make every current download return a conflict response.

### Root cause and implementation

The schema and application boundary had changed atomically on only one side. The route was updated narrowly to consume the hardened boundary without adding later checkout, worker, or customer-UX scope:

- derives a stable SHA-256 client/request fingerprint from the access-record ID, forwarded/real client address, and user agent; it never hashes or persists the bearer token as the fingerprint;
- calls the four-argument reserve RPC and consumes only its safe `grant_id`, `asset_version_id`, customer filename, state, and expiry result;
- performs the private storage-path lookup separately through the server-only service-role client;
- creates the signed URL before committing, so storage lookup/signing failure cannot consume a grant;
- commits only after signing succeeds and redirects only after commit returns `issued`;
- releases the uncommitted reservation on asset lookup, signing, or commit failure;
- returns a generic signing failure to the client so provider details or private paths cannot leak.

The migration RPC remains path-free. No temporary three-argument SQL compatibility function was added and reserve/commit/release accounting was not weakened.

### Files

- `apps/web/app/api/digital-downloads/[token]/[entitlementId]/route.ts`
- `apps/web/tests/digital-download-route.test.ts` (new)
- `apps/web/tests/digital-products-migration.test.ts`
- `.superpowers/sdd/2026-08-12-digital-products-production-hardening/task-2-report.md`

### TDD evidence

Initial route RED, before the application fix:

```text
npm test --workspace @myrivo/web -- digital-download-route.test.ts
Test Files  1 failed (1)
Tests       2 failed (2)
TypeError: .toMatch() expects to receive a string, but got undefined
```

Both success and signing-failure cases stopped at reserve because the live route did not supply `p_client_fingerprint_hash`.

A second security-focused RED proved that provider errors were still echoed:

```text
Test Files  1 failed (1)
Tests       1 failed | 1 passed (2)
Expected: { error: "Unable to prepare download." }
Received: { error: "Provider unavailable" }
```

After the minimal route changes:

```text
npm test --workspace @myrivo/web -- digital-download-route.test.ts digital-products-migration.test.ts
Test Files  2 passed (2)
Tests       18 passed (18)
```

Route coverage verifies the observable redirect and the stateful order `reserve -> server path lookup -> sign -> commit`, plus signing failure `reserve -> server path lookup -> sign -> release`. The real PostgreSQL contract additionally asserts the hardened reserve result contains the expected safe fields and has no `storage_path` property.

### Validation

- Focused route plus PostgreSQL migration contracts — 2 files, 18 tests passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors and both repository consistency checks passed.
- `npm test --workspace @myrivo/web` — 226 files, 671 tests passed.
- `npm run build --workspace @myrivo/web` — passed, including TypeScript and 156-page generation.
- `git diff --check` — passed.

Existing full-suite refund/dispute mock stderr, analytics chart-size warnings, build middleware deprecation, and stale Browserslist-data warnings remain unchanged.

### Fix-round self-review

- The route never receives a private path from the reserve RPC and never returns a private path in an error or response.
- The same fingerprint hash is used for reserve, commit, and release within the request.
- Signing failures release reservations and leave entitlement usage unchanged by the schema contract.
- Commit failure does not redirect to the already-generated signed URL; it attempts release and returns an error.
- No migration history or schema behavior was relaxed for compatibility.

## Fix Round 2: Exception-Safe Reservation Cleanup

### Review finding

The Round 1 route released a reservation only when Supabase returned an `{ error }` result. If the asset lookup, storage signer, or commit promise rejected, control escaped before release and left quota capacity reserved until the five-minute expiry. The release call itself was also awaited without protection, so a cleanup rejection could replace the intended generic failure response.

### Root cause and implementation

The post-reserve workflow had branch-local cleanup but no exception boundary. It now uses one stage-aware `try/catch/finally` around all post-reserve operations:

- the current failure stage identifies the safe server-side release reason and the generic client response;
- a committed flag changes only after commit returns `issued`;
- the `finally` block performs exactly one release attempt whenever the reservation has not committed, covering both returned failures and rejected promises;
- release remains best effort and its own rejection is contained, so it cannot mask the primary failure response;
- asset lookup and signing failures return the generic preparation error with status 500;
- returned and rejected commit failures return the generic finalization error with status 409;
- successful commit and redirect do not attempt release.

No schema or RPC contract changed.

### Files

- `apps/web/app/api/digital-downloads/[token]/[entitlementId]/route.ts`
- `apps/web/tests/digital-download-route.test.ts`
- `.superpowers/sdd/2026-08-12-digital-products-production-hardening/task-2-report.md`

### TDD evidence

Before the route fix, the expanded regression suite produced the intended RED:

```text
npm test --workspace @myrivo/web -- digital-download-route.test.ts
Test Files  1 failed (1)
Tests       5 failed | 3 passed (8)
```

Rejected asset lookup, signing, and commit operations escaped with their dependency errors. The returned commit-error case exposed `Database unavailable` instead of the generic finalization response, and the cleanup-rejection case failed with the original unhandled signing rejection before it could establish best-effort behavior.

After the minimal exception-safe control-flow change:

```text
npm test --workspace @myrivo/web -- digital-download-route.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)
```

Coverage now exercises the successful reserve/lookup/sign/commit sequence; returned and rejected asset lookup failures; returned and rejected storage signing failures; returned and rejected commit failures; and a release rejection that must not mask the primary response. Every non-committed failure asserts one release attempt with the matching safe reason and operation order.

### Validation

- Focused route plus PostgreSQL migration contracts — 2 files, 24 tests passed.
- `npm run typecheck --workspace @myrivo/web` — passed.
- `npm run lint --workspace @myrivo/web` — passed with zero warnings/errors and both repository consistency checks passed.
- `npm test --workspace @myrivo/web` — 226 files, 677 tests passed.
- `npm run build --workspace @myrivo/web` — passed, including TypeScript and 156-page generation.

The full suite retained the existing refund/dispute mock stderr and analytics chart-size warnings. The build retained the existing middleware deprecation and stale Browserslist-data warnings.

### Fix-round self-review

- Every path after a successful reserve reaches the single `finally` cleanup decision.
- Returned failures and thrown/rejected dependencies release exactly once while the committed flag remains false.
- The committed flag is set only after the database reports `issued`, preventing release on success.
- Cleanup rejection is swallowed only inside the best-effort release boundary; primary stage failures retain their generic status and body.
- No provider error, database error, bearer token, or private storage path is returned to the client.
