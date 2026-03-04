# Release Readiness Checklist

This checklist is for the final release cut from `develop` to `main`.

## Product readiness

- [ ] Merchant flow tested end-to-end: signup -> onboarding -> dashboard setup -> storefront checkout.
- [ ] Inventory movement ledger updates correctly for each completed order.
- [ ] Promo code flow validated (valid, expired, inactive, redemption cap, min subtotal).
- [ ] Fulfillment status transitions verified from dashboard for operational workflows.
- [ ] Orders CSV export verified for accounting/reporting.
- [ ] Promo preview UX verified against final checkout totals.
- [ ] Insights dashboard metrics match exported order data.
- [ ] Store policies and announcement copy render correctly on storefront.
- [ ] Storefront content blocks render and CTA links are correct.
- [ ] Brand/theme configurator validated across final theme combinations.

## Platform readiness

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Latest Supabase migrations applied in target environment.
- [ ] Stripe webhook endpoint verified reachable from production.
- [ ] Error monitoring + alerting enabled for checkout and webhooks.

## Stripe (store payments only)

- [ ] Set `STRIPE_STUB_MODE=false`.
- [ ] Set live Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- [ ] Verify the store can connect Stripe account in `Dashboard > Account Settings`.
- [ ] Verify connected account capabilities (`charges_enabled`, `payouts_enabled`) before checkout.
- [ ] Confirm storefront checkout webhook finalization works:
  `checkout.session.completed` creates exactly one order and updates inventory.
- [ ] Validate failed/cancelled payment paths do not create paid orders.
- [ ] Confirm support runbook for payout/account-disabled incidents.

## Shipping + fulfillment readiness

- [ ] Configure shipping env vars (`SHIPPING_PROVIDER`, `EASYPOST_API_KEY`, `SHIPPING_WEBHOOK_SECRET`) for live tracking sync.
- [ ] Configure shipping provider webhook to `POST /api/shipping/webhook?token=<SHIPPING_WEBHOOK_SECRET>`.
- [ ] Verify order lifecycle transitions: `pending_fulfillment -> packing -> shipped -> delivered`.
- [ ] Verify `Ship` action saves carrier/tracking and generates tracking URL.
- [ ] Verify at least one real webhook event updates order to `delivered` automatically.
- [ ] Validate printable documents: daily pick list and per-order packing slips.

## Operational readiness

- [ ] Branch protections intact for `main` and `develop`.
- [ ] Required CI checks are green on release PR.
- [ ] Rollback plan defined (previous deploy + DB migration rollback strategy).

## Governance and trust readiness

- [ ] Refund/dispute SOP defined and tested for At Home Apothecary operations.
- [ ] Buyer/seller post-purchase communication process documented.
- [ ] Fulfillment workflow configured for current offline operations.
- [ ] Email notification roadmap approved before enabling automated post-purchase messaging.
