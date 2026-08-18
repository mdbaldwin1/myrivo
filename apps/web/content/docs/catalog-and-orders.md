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

Fulfillment is set with the **Fulfillment** field in the product editor, and belongs to whatever a buyer actually buys. A product with no variants answers for itself. Once it has variants, each variant chooses its own, defaulting to *Same as product*; if a variant is split into options, each option chooses.

This means one product can be sold more than one way. A painting can offer a **Download**, a **Print** posted to the buyer, and the **Original** canvas as three variants of the same listing, rather than three separate products. Shipping is charged and an address collected only for the parts that ship.

**Customer downloads** appear beside the SKU, at whichever level owns it, and only for the variants sold as downloads. Add JPG, PNG, PDF, or ZIP files with the **+** button; rename a file by clicking its name, and reorder or manage it from the **⋯** menu. Files added to a variant that has not been saved yet wait in the browser and upload with the product when you save it.

Original files always remain private. Buyers see a digital variant only as a watermarked preview, generated automatically from the file when it is a JPG or PNG. A file type that cannot be watermarked needs a storefront image to stand in before the product can be published.

Once files are attached you are asked to confirm you hold the rights to sell them, which is required before publishing.

A variant that holds files cannot then be split into variants or options, because its files would be left on something a buyer no longer buys. Remove the files first, and the toggle explains this on hover.

### Storefront images

Images you upload are what buyers browse. Each one has a **⋯** menu to feature it, replace it, remove it, or **add a watermark** — useful when the picture you want to show is the artwork you are selling. Watermarking writes a new copy and leaves the original in place, so **Remove watermark** puts it back. Nothing changes until you save the product. Click an image to view it full size.

On a product where every variant is a download, your uploaded images are never shown to buyers at all; only the watermarked preview is. As soon as one variant ships, your photographs are shown as they are, and the download variants are still represented only by their preview.

Digital items have a quantity of one. Digital-only checkout asks for name and email but omits phone and physical fulfillment; mixed carts retain physical fulfillment. Buyers consent to immediate digital delivery and the platform personal-use license at checkout.

After successful payment, Myrivo snapshots the purchased file versions and emails a secure access link valid for 48 hours. Each purchased file permits five successful download grants. A buyer can request a fresh 48-hour link using the order ID and order email; issuing a new link does not reset download grants.

The secure credential is exchanged privately when the buyer opens the page and is removed from the address immediately. Download pages and file links therefore remain safe to revisit without placing the credential in browser history or ordinary request paths.

Replacing a catalog file affects only future purchases. Existing buyers continue to receive the exact version included in their purchase. Removing a file from the current listing likewise does not remove it from a completed order.

If delivery is still being prepared after payment, buyers can retry the status check from the confirmation page. For mixed orders, shipping or pickup steps continue even if digital delivery needs attention. Store operators can inspect delivery status from the order, resend a link after initial delivery succeeds, or ask a platform operator to requeue or reconcile failed work. Never copy a buyer's secure link into support notes.

Digital purchases are generally final after the first download except for defects, duplicate purchases, misrepresentation, or other required exceptions. A successful full refund revokes remaining access, while partial refunds preserve it. Open disputes suspend downloads, won disputes restore access, and lost disputes revoke it.

For expired or missing links, use `/downloads/request`. The response is intentionally the same whether or not the submitted details match an order. This protects customer information; repeated requests may be temporarily limited.
