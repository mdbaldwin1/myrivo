# Accessibility Support Runbook

## Public support path

- Public accessibility statement: `/accessibility`
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

## Verification checklist

Before shipping major storefront or dashboard-shell changes, verify:

- skip link is visible on focus and moves focus to the main content region
- repeated navigation surfaces expose a clear current-page state
- motion-heavy surfaces respect `prefers-reduced-motion`
- charts have a usable non-visual fallback or are explicitly decorative
- form labels and descriptions are associated with controls
- the public `/accessibility` page is reachable from marketing and storefront footers

## Escalation guidance

- Treat checkout-blocking issues as high priority.
- Treat authentication, onboarding, and store-management blockers as high priority.
- If a regression affects a shared primitive, fix the primitive instead of patching one surface at a time.
