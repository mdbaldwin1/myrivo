# Marketing Experiments Runbook

## Purpose

This runbook defines how to launch and review lightweight marketing experiments in Myrivo without turning the public site into an uncontrolled copy lab.

## Current Surface

Marketing analytics live at:

- `/dashboard/admin/marketing`

Current experiment framework is lightweight:

- deterministic variant assignment by marketing session
- public-site CTA and funnel tracking
- experiment snapshot reporting by variant

## Before Launching An Experiment

1. Write a single-sentence hypothesis.
2. Decide the one thing that is changing.
3. Confirm the primary conversion target:
   - signup start
   - signup completion
   - demo request start
4. Confirm the affected page and CTA surface.
5. Make sure cookie consent gating is still respected.

## Good Experiment Boundaries

Good candidates:

- CTA label copy
- hero emphasis
- supporting proof-point ordering
- page-specific value framing

Bad candidates:

- hiding pricing details
- obscuring legal or privacy disclosures
- changing navigation in a way that breaks discoverability
- mixing multiple unrelated copy changes in the same experiment

## Review Checklist

Review the following in `/dashboard/admin/marketing`:

- sessions by page
- CTA clicks by page and section
- signup starts by CTA
- signup completions by CTA
- experiment sessions by variant
- experiment signup starts and completions by variant

Ask:

- did one variant increase starts but hurt completions?
- did traffic quality change by page?
- is the result large enough to be credible?

## Decision Logging

For each experiment, record:

- experiment key
- hypothesis
- variants
- launch date
- review date
- chosen outcome
- next follow-up change

Keep this record in the planning tracker or linked project note so future copy changes are not disconnected from prior learnings.
