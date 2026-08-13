---
slug: catalog-and-orders
title: Catalog and Orders
summary: Manage products, inventory behavior, and order fulfillment in a single store workspace.
category: Operations
audience: Store owners, admins, and operations staff
lastUpdated: August 2026
owner: Merchant Education
reviewCadence: Quarterly
reviewBy: 2026-06-30
---

## Catalog Workflow
Use Catalog to create products and variants, then validate storefront product cards and pricing.

Keep inventory synchronized before promotions to avoid overselling.

## Order Fulfillment
Use Orders to review status, print pick/pack assets, and complete shipment or pickup handling.

## Operational Guardrails
When changing product structure after orders exist, verify downstream reporting and export behavior.

- Review order totals
- Confirm inventory ledger movements
- Test shipping labels and tracking updates

## Related Docs

- `/docs/pickup-and-shipping-operations`
- `/docs/refunds-disputes-and-customer-issues`
- `/docs/reviews-and-customer-trust`
- `/docs/storefront-analytics-and-reporting`
# Digital products

Products can be marked as **Digital download** in Catalog. Merchants must affirm that they have rights to sell the files, then save the draft and use the inspector's **Files** tab to upload one or more JPG, PNG, PDF, or ZIP files. Original files remain private. Image originals receive an automatic reduced-resolution, tiled store-name watermark for their storefront preview.

Digital items have a quantity of one. Digital-only checkout asks for name and email but omits phone and physical fulfillment; mixed carts retain physical fulfillment. Buyers consent to immediate digital delivery and the platform personal-use license at checkout.

After successful payment, Myrivo snapshots the purchased file versions and emails a secure access link valid for 48 hours. Each purchased file permits five successful download grants. A buyer can request a fresh 48-hour link using the order ID and order email; issuing a new link does not reset download grants.

Replacing a catalog file affects only future purchases. Existing buyers continue to receive the exact version included in their purchase. Removing a file from the current listing likewise does not remove it from a completed order.

If delivery is still being prepared after payment, buyers can retry the status check from the confirmation page. For mixed orders, shipping or pickup steps continue even if digital delivery needs attention. Store operators can inspect delivery status from the order, resend a link after initial delivery succeeds, or ask a platform operator to requeue or reconcile failed work. Never copy a buyer's secure link into support notes.

Digital purchases are generally final after the first download except for defects, duplicate purchases, misrepresentation, or other required exceptions. A successful full refund revokes remaining access, while partial refunds preserve it. Open disputes suspend downloads, won disputes restore access, and lost disputes revoke it.

For expired or missing links, use `/downloads/request`. The response is intentionally the same whether or not the submitted details match an order. This protects customer information; repeated requests may be temporarily limited.
