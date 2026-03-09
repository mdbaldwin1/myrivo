# Incident Playbook

## 1) Checkout failures

- Check `/api/orders/checkout` logs for validation or RPC errors.
- Validate `stub_checkout_create_paid_order` exists and is executable by `service_role`.
- Temporarily disable promotions if promo-related failures spike.

## 2) Inventory drift reports

- Compare `products.inventory_qty` against `inventory_movements` ledger totals.
- Review recent manual adjustments in audit events.
- Lock affected product to `draft` until corrected.

## 3) Auth/session issues

- Verify Supabase URL/keys are present and valid.
- Confirm cookie settings and callback route health.
- Test login from clean browser session.

## 4) Domain rendering problems

- Confirm store status is `active`.
- Confirm domain record exists and is `verified`.
- Verify host routing logic in tenant resolver.

## 5) Immediate mitigation actions

- Suspend impacted store (`stores.status='suspended'`).
- Deactivate problematic promotion (`promotions.is_active=false`).
- Route traffic to maintenance notice if broad outage occurs.
