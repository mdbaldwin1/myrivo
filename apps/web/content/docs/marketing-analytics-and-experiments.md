---
slug: marketing-analytics-and-experiments
title: Marketing Analytics and Experiments
summary: Understand how Myrivo tracks public-site conversion, where to read performance, and how to run lightweight CTA experiments safely.
category: Reporting
audience: Operators, admins, and anyone responsible for growth decisions
lastUpdated: March 2026
owner: Growth Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## What Gets Tracked
Myrivo tracks public marketing-site page views, CTA clicks, signup starts, signup completions, demo request starts, and experiment assignments on the public site. Tracking respects the platform cookie-consent layer, so analytics events are only collected when analytics cookies are enabled.

- Page views across the public marketing pages
- CTA clicks by page and section
- Signup starts and completions
- Demo request starts
- Active experiment variant assignments

## Where To Read It
Open the admin workspace at `/dashboard/admin/marketing`. The page shows headline funnel metrics, daily traffic and signup trend charts, page-level conversion, CTA performance, and experiment readouts.

Use this page to answer:

- Which public pages attract the most sessions?
- Which CTAs drive the most signup starts?
- Which pages or CTAs convert poorly and need new copy?
- Which experiment variant is performing better right now?

## Experiment Process
Experiments in Myrivo are lightweight and deterministic. A visitor is assigned a variant from their marketing session, and that assignment stays stable so conversion results remain readable.

For now, run experiments with a simple process:

- Define one hypothesis at a time
- Change one major variable per experiment
- Keep CTA destination and funnel path consistent
- Leave the experiment running long enough to gather meaningful session volume
- Review both signup starts and signup completions before deciding a winner

## Safe Operating Guidance
Do not use experiments to hide core pricing, legal, or trust information. Keep experiments focused on messaging, CTA labeling, or page emphasis instead of changing the fundamental offer unexpectedly.

Use the related internal runbook for experiment logging, launch checks, and outcome review:

- `docs/runbooks/marketing-experiments.md`

## Related Docs

- `/docs/admin-dashboard-and-operations`
- `/docs/release-operations-and-deployments`
