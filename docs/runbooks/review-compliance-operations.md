# Review Compliance Operations

This runbook defines the operating rules for review collection, moderation, and merchant guidance so review features strengthen trust instead of creating compliance risk.

## Goal

Review tooling should help stores collect honest feedback while avoiding practices that:

- hide legitimate negative sentiment
- blur whether a review was incentivized
- pressure customers into positive-only responses
- treat moderation as reputation management instead of policy enforcement

## Collection rules

- Ask all relevant customers for feedback, not only happy customers.
- Do not filter review requests based on sentiment or support outcome.
- Keep review invitations neutral in tone.
- If a customer received any incentive connected to leaving a review, the review flow should support disclosure.

## Incentive rule

- Incentivized reviews are not banned outright, but they must be clearly disclosed.
- Disclosure should travel with the review record and be visible to moderators and storefront readers.
- Stores should never imply that only positive reviews qualify for the incentive.

## Moderation rule

Moderation exists to remove content that is:

- abusive
- fraudulent
- spammy
- privacy violating
- clearly off topic

Moderation does **not** exist to remove a review just because it is:

- negative
- low rated
- inconvenient
- commercially awkward

## Owner response rule

- Owner responses should clarify, apologize, or resolve issues.
- Responses should not pressure customers to edit or remove legitimate reviews.
- If a review has an active owner response, moderation actions should still preserve a clear audit trail.

## Expected product guardrails

- solicitation defaults should be neutral and broad-based
- disclosure support should exist for incentivized reviews
- moderation actions should require a clear reason
- risky actions should be auditable
- merchant docs should explain that negative-but-legitimate reviews are allowed

## Escalation

- Store staff handle first-line moderation for their own storefront
- Platform/admin escalates when there is repeat abuse, legal uncertainty, or a pattern of suppression behavior

## Rollout and verification

Before enabling new review collection changes broadly, verify:

- the storefront review form captures incentive disclosure when applicable
- disclosed reviews show the disclosure to storefront readers
- moderation detail shows disclosure context to operators
- moderation routes reject blatantly sentiment-based reject reasons
- moderation, owner-response, and media actions all produce audit events

Recommended regression coverage:

- review submission route validation
- disclosure metadata helpers
- moderation route constraints
- response route audit logging
- merchant docs build/route coverage
