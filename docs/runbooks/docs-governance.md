# Docs Governance Runbook

This runbook keeps the file-backed docs library in `/apps/web/content/docs` operationally trustworthy instead of letting it drift into stale reference material.

## Ownership model

Every docs page must declare:

- `owner`: the team or function accountable for freshness
- `reviewCadence`: `Monthly`, `Quarterly`, or `Semiannual`
- `reviewBy`: the next required review date in `YYYY-MM-DD`

These values are part of the docs frontmatter and render in the public docs experience at `/docs`.

## Review expectations

- `Monthly`: use for admin, support, compliance, or operational procedures that can break quickly when workflows change.
- `Quarterly`: use for merchant education and product guides that change less often but still need regular reality checks.
- `Semiannual`: use sparingly and only for very stable documentation.

When a doc is reviewed:

1. Confirm the linked routes, flows, and commands still match the product.
2. Update the body content if behavior changed.
3. Refresh `lastUpdated`.
4. Move `reviewBy` forward according to the chosen cadence.
5. Reconsider `owner` and `reviewCadence` if the doc has changed hands or become more volatile.

## Overdue handling

Docs whose `reviewBy` date is in the past are considered stale.

Required action:

1. Review the doc before relying on it for support, launch, or compliance work.
2. Update the doc or explicitly de-scope/remove it if the workflow no longer exists.
3. Do not ship major workflow changes without updating the impacted docs in the same branch.

The docs UI surfaces overdue status directly so support and operators can spot stale guidance quickly.

## Release gate

Before a release from `develop` to `main`:

1. Review `/docs` for any overdue documents.
2. Verify the merchant-facing docs used in launch/support flows are current.
3. Confirm any user-visible workflow changes in the release updated the relevant docs page(s) and runbook(s).

This requirement is also reflected in `docs/release-readiness-checklist.md`.

## Validation

At minimum, run:

- `npm test -- --run tests/docs-content.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Escalation

If ownership is unclear:

1. Route to the most directly affected function first:
   - merchant setup and storefront docs -> Merchant Education / Support Operations
   - admin and platform operations docs -> Platform Operations
   - compliance/legal docs -> Compliance Operations
   - moderation docs -> Trust & Safety
   - marketing analytics docs -> Growth Operations
2. If no clear owner exists, escalate to Product/Engineering and assign one before the next release cut.
