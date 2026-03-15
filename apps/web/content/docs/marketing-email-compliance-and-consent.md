---
slug: marketing-email-compliance-and-consent
title: Marketing Email Compliance and Consent
summary: Understand the boundary between transactional email, marketing subscribers, sender identity, and unsubscribe expectations.
category: Team
audience: Store owners, growth operators, and compliance stakeholders
lastUpdated: March 2026
owner: Compliance Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Product Boundary

Myrivo separates email into two different jobs:

- `Email Studio` controls transactional lifecycle messages tied to orders and fulfillment events
- `Subscribers` represents marketing consent and unsubscribe state for promotional email

Those are related, but they are not the same workflow.

## Transactional Email

Transactional email should stay focused on:

- order confirmations
- fulfillment and pickup updates
- shipping delays
- refunds and disputes

These messages are operational. They should be clear, accurate, and easy to reply to.

## Marketing Email

Marketing sends should depend on subscriber consent and suppression state.

Use the subscriber list to understand:

- who is currently subscribed
- who has unsubscribed
- where a subscriber came from

Do not treat Email Studio templates as a substitute for campaign consent checks.

## Sender Expectations

Before sending any customer email at scale, confirm:

- sender name matches the store identity
- reply-to points somewhere monitored
- promotional email includes unsubscribe and sender/footer disclosure requirements

## Marketing Send Defaults

The `Subscribers` workspace now includes a `Marketing send defaults` panel.

Use it to verify:

- the current sender display name
- the current platform-managed from address
- the resolved reply-to and support email
- the public unsubscribe and privacy-policy links shoppers will use
- whether a mailing address is configured for footer disclosures

If the panel shows `Needs attention`, resolve the warnings before treating the list as campaign-ready.

Typical fixes:

- update support email in Store Settings / Legal
- update mailing address fields in Store Settings
- review storefront privacy links in Storefront Studio

## Related Docs

- `/docs/email-studio-and-lifecycle-messages`
- `/docs/promotions-and-subscribers`
- `/docs/legal-governance-and-consent-ops`
- `/docs/welcome-popup-discount-campaigns`
