---
slug: accessibility-quality-and-release-governance
title: Accessibility Quality and Release Governance
summary: Understand the accessibility quality bar, target flows, release gates, and support expectations for Myrivo.
category: Team
audience: Engineering, design, product, and support teams
lastUpdated: March 2026
owner: Product Engineering
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Target Flows

Accessibility review should always cover these journeys first:

- storefront browse-to-buy and product discovery
- cart and checkout completion
- customer account and order lookup
- dashboard navigation and store management
- privacy, legal, and consent workflows

## Release Gates

Before shipping a meaningful UI change, confirm:

- keyboard access and visible focus still work on the changed surface
- skip-link and main-content focus behavior still work on shared shells
- motion-heavy or loading-heavy surfaces respect reduced-motion preferences
- forms keep labels, descriptions, and error messages associated correctly
- charts or data-heavy panels keep a readable fallback when visuals are limited

## Severity Expectations

Treat these as release blockers:

- checkout completion blocked for keyboard or assistive-technology users
- authentication or account access blocked
- store-management tasks blocked for keyboard-only users
- critical privacy or legal actions blocked

## Evidence Matrix

We keep a practical evidence model for our highest-risk flows. This is a support and release-governance tool, not a formal WCAG certification statement.

| Flow | Evidence we keep | Primary owner |
| --- | --- | --- |
| storefront browse-to-buy and product discovery | axe audit coverage on key public flows; manual keyboard and focus review on changed storefront surfaces | Engineering + QA |
| cart and checkout completion | axe audit coverage for cart and checkout; manual checkout walkthrough for keyboard and assistive-technology blockers | Engineering + Support |
| customer account and order lookup | manual label and focus review; support triage for account and order-access barriers | Engineering + Support |
| dashboard navigation and store management | axe audit coverage for dashboard shell; manual navigation and form review on changed store-management flows | Engineering + Product |
| privacy, legal, and consent workflows | manual review of legal and consent forms; operator verification of public intake and support handoff paths | Engineering + Support |

## Conformance Position

We are improving accessibility continuously and maintaining release evidence for key flows, but we are not making a formal WCAG conformance claim right now.

## Routine Release Evidence

Before a release cut:

- run `npm run e2e -- e2e/accessibility-audits.spec.ts`
- review the public `/accessibility` page and confirm the intake path is current
- review the Admin Workspace accessibility queue and triage any unresolved high-severity or critical reports
- update the evidence matrix expectations if the release materially changes a target flow

## Team Roles

- Engineering owns shared primitive fixes, automated checks, and release gating
- Product and design own flow review, clear interaction patterns, and non-visual comprehension
- Support and ops own high-quality intake, escalation, and follow-up for reported barriers

## Related Docs

- `/docs/accessibility`
- `/docs/release-readiness-checklist`
- `/docs/support-operations-and-escalation`
