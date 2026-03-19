# Release Readiness Checklist

This checklist is for the final release cut from `develop` to `main`.

## Product readiness

- [ ] Merchant flow tested end-to-end: signup -> onboarding -> dashboard setup -> storefront checkout. (Owner: QA, Target: 2026-03-12)
- [ ] Inventory movement ledger updates correctly for each completed order. (Owner: Backend, Target: 2026-03-11)
- [ ] Promo code flow validated (valid, expired, inactive, redemption cap, min subtotal). (Owner: QA, Target: 2026-03-12)
- [ ] Fulfillment status transitions verified from dashboard for operational workflows. (Owner: Ops, Target: 2026-03-12)
- [ ] Orders CSV export verified for accounting/reporting. (Owner: Ops, Target: 2026-03-13)
- [ ] Promo preview UX verified against final checkout totals. (Owner: QA, Target: 2026-03-12)
- [ ] Insights dashboard metrics match exported order data. (Owner: Analytics, Target: 2026-03-13)
- [ ] Store policies and announcement copy render correctly on storefront. (Owner: Content, Target: 2026-03-11)
- [ ] Storefront content blocks render and CTA links are correct. (Owner: Content, Target: 2026-03-11)
- [ ] Brand/theme configurator validated across final theme combinations. (Owner: Design, Target: 2026-03-13)

## Platform readiness

- [ ] `npm run lint` (Owner: Engineering, Target: 2026-03-10)
- [ ] `npm run typecheck` (Owner: Engineering, Target: 2026-03-10)
- [ ] `npm run test` (Owner: Engineering, Target: 2026-03-10)
- [ ] `npm run build` (Owner: Engineering, Target: 2026-03-10)
- [ ] `npm run e2e -- e2e/accessibility-audits.spec.ts` completed for the release candidate. (Owner: QA/Engineering, Target: 2026-03-14)
- [ ] Accessibility spot check completed for changed flows: keyboard access, visible focus, form semantics, and reduced-motion behavior. (Owner: QA/Engineering, Target: 2026-03-14)
- [ ] Accessibility evidence matrix reviewed for any changed target flow and support routing remains current. (Owner: Product/Engineering, Target: 2026-03-14)
- [ ] Any changed chart or dashboard module has a readable fallback or is confirmed decorative. (Owner: Engineering/Design, Target: 2026-03-14)
- [ ] `/docs` reviewed for overdue documentation and stale workflow guidance before release cut. (Owner: Documentation, Target: 2026-03-13)
- [ ] Latest Supabase migrations applied in target environment. (Owner: Engineering, Target: 2026-03-10)
- [ ] `npm run verify:platform-rollout` passes in target environment. (Owner: Engineering, Target: 2026-03-10)
- [ ] Reviews rollout gate configured (`REVIEWS_FEATURE_ENABLED`, `REVIEWS_ROLLOUT_STORE_SLUGS`) per launch phase. (Owner: Engineering, Target: 2026-03-12)
- [ ] Reviews aggregate snapshot backfill completed using `scripts/reviews-backfill-aggregate-snapshots.mjs`. (Owner: Engineering, Target: 2026-03-12)
- [ ] Stripe webhook endpoint verified reachable from production. (Owner: Engineering, Target: 2026-03-11)
- [ ] Error monitoring + alerting enabled for checkout and webhooks. (Owner: Engineering, Target: 2026-03-13)

## Stripe (store payments only)

- [ ] Set `STRIPE_STUB_MODE=false`. (Owner: Engineering, Target: 2026-03-10)
- [ ] Set live Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). (Owner: Engineering, Target: 2026-03-10)
- [ ] Verify the store can connect Stripe account in `Dashboard > Account Settings`. (Owner: QA, Target: 2026-03-11)
- [ ] Verify connected account capabilities (`charges_enabled`, `payouts_enabled`) before checkout. (Owner: QA, Target: 2026-03-11)
- [ ] Confirm storefront checkout webhook finalization works: `checkout.session.completed` creates exactly one order and updates inventory. (Owner: Backend, Target: 2026-03-11)
- [ ] Validate failed/cancelled payment paths do not create paid orders. (Owner: QA, Target: 2026-03-11)
- [ ] Confirm support runbook for payout/account-disabled incidents. (Owner: Ops, Target: 2026-03-13)
- [ ] Checkout uses connected-account tax liability (`automatic_tax.liability.account=<CONNECTED_ACCOUNT_ID>`) instead of defaulting to the platform account. (Owner: Engineering, Target: 2026-03-14)
- [ ] Stripe Tax enabled and configured on each seller-connected account used for live checkout. (Owner: Finance/Ops, Target: 2026-03-14)
- [ ] Seller-connected account business address, tax defaults, and registrations configured for all required jurisdictions. (Owner: Finance/Ops, Target: 2026-03-14)
- [ ] Merchant-facing tax readiness/status checks block live launch when connected-account tax setup is incomplete. (Owner: Engineering, Target: 2026-03-14)

## Shipping + fulfillment readiness

- [ ] Configure shipping env vars (`SHIPPING_PROVIDER`, `EASYPOST_API_KEY`, `SHIPPING_WEBHOOK_SECRET`, `SHIPPING_WEBHOOK_SIGNING_SECRET`) for live tracking sync. (Owner: Engineering, Target: 2026-03-11)
- [ ] Configure shipping provider webhook to `POST /api/shipping/webhook` and include header `x-shipping-webhook-secret`. If signature verification is enabled, include `x-shipping-timestamp` and `x-shipping-signature`. (Owner: Engineering, Target: 2026-03-11)
- [ ] Verify order lifecycle transitions: `pending_fulfillment -> packing -> shipped -> delivered`. (Owner: Ops, Target: 2026-03-12)
- [ ] Verify `Ship` action saves carrier/tracking and generates tracking URL. (Owner: Ops, Target: 2026-03-12)
- [ ] Verify at least one real webhook event updates order to `delivered` automatically. (Owner: Ops, Target: 2026-03-12)
- [ ] Validate printable documents: daily pick list and per-order packing slips. (Owner: Ops, Target: 2026-03-12)
- [ ] Verify shipping-delay flow: staff can record a delay, customer receives the update, and approval/cancellation responses appear in the order timeline. (Owner: Ops, Target: 2026-03-14)
- [ ] Confirm live shipping policy copy explains how revised ship dates and cancellation requests are handled. (Owner: Content/Ops, Target: 2026-03-14)

## Operational readiness

- [ ] Branch protections intact for `main` and `develop`. (Owner: Engineering, Target: 2026-03-10)
- [ ] Required CI checks are green on release PR. (Owner: Engineering, Target: 2026-03-10)
- [ ] Rollback plan defined (previous deploy + DB migration rollback strategy). (Owner: Engineering, Target: 2026-03-13)

## Governance and trust readiness

- [ ] Refund/dispute SOP defined and tested for At Home Apothecary operations. (Owner: Ops, Target: 2026-03-14)
- [ ] Buyer/seller post-purchase communication process documented. (Owner: Ops, Target: 2026-03-14)
- [ ] Fulfillment workflow configured for current offline operations. (Owner: Ops, Target: 2026-03-12)
- [ ] Email notification roadmap approved before enabling automated post-purchase messaging. (Owner: Product, Target: 2026-03-12)
- [ ] Review collection guidance confirms neutral solicitation and disclosure expectations for any incentivized reviews. (Owner: Ops/Content, Target: 2026-03-14)
- [ ] Privacy rights workflow verified end-to-end: GPC disables optional analytics, do-not-sell/share intake creates explicit opt-out state, and Legal workflow shows operator context. (Owner: Ops/Engineering, Target: 2026-03-14)
- [ ] Accessibility support path verified end-to-end: `/accessibility` is reachable, intake guidance is current, and any checkout/auth/store-management barriers are triaged as release issues. (Owner: Support/Product, Target: 2026-03-14)
- [ ] Platform accessibility queue reviewed: no unresolved critical reports are missing owner/status before release cut. (Owner: Support/Product, Target: 2026-03-14)
