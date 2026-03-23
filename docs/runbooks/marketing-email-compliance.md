# Marketing Email Compliance Runbook

## Scope

This runbook covers the operational boundary between transactional lifecycle email and marketing email.

It includes:

- Email Studio ownership
- subscriber-list ownership
- sender and reply-to expectations
- unsubscribe and suppression posture for promotional email

## Product Model

Transactional:

- order confirmations
- shipping and pickup updates
- shipping delays
- refunds and disputes

Marketing:

- newsletter and promotional sends
- subscriber growth and suppression state
- future campaigns and segmentation workflows

## Current Expectations

- Email Studio is the transactional workspace
- the subscriber list is the current source of truth for marketing consent state
- promotional email should not be sent to unsubscribed contacts
- transactional delivery should not depend on marketing subscriber status

## Operator Checklist

Before enabling or reviewing customer email behavior:

1. confirm sender name is accurate for the store
2. confirm reply-to points to a monitored inbox
3. confirm subscriber exports reflect unsubscribe state
4. confirm transactional templates stay informational, not promotional
5. confirm the `Marketing send defaults` panel in Subscribers shows valid unsubscribe, privacy, and mailing-address disclosures

## Current Product Support

Today, Myrivo supports marketing email compliance through:

- subscriber consent and suppression tracking
- consent provenance and unsubscribe metadata
- a readiness/defaults panel in `Subscribers` that resolves sender, reply-to, public links, and footer-address readiness

Treat that panel as the preflight check before any future promotional send tooling is layered on top.

## Known Limitations

- Myrivo does not yet have a full promotional campaign builder
- consent provenance and suppression reporting are still intentionally lightweight
- sender identity still uses the platform-managed from address
- campaign-specific footer composition is not yet editable
