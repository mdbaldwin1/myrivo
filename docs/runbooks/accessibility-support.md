# Accessibility Support Runbook

## Public support path

- Public accessibility statement: `/accessibility`
- Public accessibility intake form: `/accessibility` report form
- Support email: `hello@myrivo.app`
- Suggested subject line: `Myrivo Accessibility Support`

## What to ask for in a report

When someone reports an accessibility barrier, capture:

- the page or feature they were using
- what they expected to do
- what happened instead
- browser and device
- any assistive technology in use
- whether the issue blocks checkout, account access, or store management

## Current product stance

- Accessibility is an active product priority.
- We provide a public reporting path and are hardening keyboard access, landmarks, form semantics, reduced-motion behavior, and analytics fallbacks.
- We are not making a formal WCAG conformance claim right now.

## Quality bar and ownership

- Review checkout, account access, store management, and legal/privacy flows first.
- Treat checkout, authentication, and store-management barriers as release-impacting issues.
- Fix shared-component regressions in the primitive instead of patching one page at a time.
- Capture assistive technology, browser, and zoom/context details in every report.

## Verification checklist

Before shipping major storefront or dashboard-shell changes, verify:

- skip link is visible on focus and moves focus to the main content region
- repeated navigation surfaces expose a clear current-page state
- motion-heavy surfaces respect `prefers-reduced-motion`
- charts have a usable non-visual fallback or are explicitly decorative
- form labels and descriptions are associated with controls
- the public `/accessibility` page is reachable from marketing and storefront footers

## Release governance

Before a release cut:

- confirm changed flows were reviewed for keyboard access and visible focus
- confirm motion-heavy surfaces respect `prefers-reduced-motion`
- confirm any new charts or visual summaries expose a readable fallback
- confirm open accessibility issues are triaged by severity, not left as generic backlog noise

## Operator workflow

- Support and admins review incoming accessibility reports in the Admin Workspace platform console.
- Move reports from `new` to `triaged` once severity and affected flow are understood.
- Move active fixes to `in_progress`.
- Mark reports `resolved` only after a human re-check of the affected flow.
- Dismiss only obvious duplicates or reports that cannot be reproduced after documented follow-up.

## Escalation guidance

- Treat checkout-blocking issues as high priority.
- Treat authentication, onboarding, and store-management blockers as high priority.
- If a regression affects a shared primitive, fix the primitive instead of patching one surface at a time.
