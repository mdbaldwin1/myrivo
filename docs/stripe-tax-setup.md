# Stripe Tax Setup (Launch Runbook)

Myrivo now enables `automatic_tax` on Stripe Checkout sessions in `/api/orders/checkout`.

This runbook is intentionally explicit and click-by-click.

## Important context for this app

- We create Checkout Sessions from the **platform Stripe account** and use **destination charges** to transfer funds to connected stores.
- We currently set `automatic_tax.enabled=true` and **do not set** `automatic_tax.liability`.
- Per Stripe, if `automatic_tax.liability` is set, tax settings/registrations are loaded from the referenced account; when omitted, tax configuration comes from the requesting account.
- In our current code path, that means tax setup is driven by the **platform account** (not each connected account).

References:
- [Checkout Session create API](https://docs.stripe.com/api/checkout/sessions/create)
- [Tax for software platforms](https://docs.stripe.com/tax/tax-for-platforms)
- [Use Stripe Tax with Connect](https://docs.stripe.com/tax/connect)

## Phase 1: Turn on Stripe Tax in platform account (required now)

1. Open Stripe Dashboard in the account your backend key belongs to.
2. Go to [Settings > Tax](https://dashboard.stripe.com/settings/tax).
3. Click **Get started** if Stripe Tax is not yet enabled.

What to set:
- **Head office address**: set your legal business address exactly as registered.
- **Preset product tax code**: choose the closest default for your catalog.
- **Preset shipping tax code**: set this if you charge shipping.
- **Include tax in prices**:
  - For US-style pricing, set default behavior to **Exclusive**.
  - Use **Inclusive** only if you want tax included in listed prices.

Reference:
- [Set up Stripe Tax](https://docs.stripe.com/tax/set-up)
- [Product tax codes and tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior)

## Phase 2: Add registrations (critical)

1. Go to [Tax > Registrations](https://dashboard.stripe.com/tax/registrations).
2. Click **+ Add registration**.
3. For each jurisdiction where you must collect:
  - Choose country/state/province.
  - Choose **I’ve already registered** (or Stripe-assisted registration where available).
  - Enter registration details exactly as issued by the authority.
  - Set collection timing:
    - **Start collecting immediately** if active now.
    - **Schedule tax collection** with effective date/time if future-dated.
4. Repeat for all required jurisdictions.

Notes:
- If no registration is active for a jurisdiction, Stripe Tax can return `0.00` with non-collecting reasons.
- Registration decisions are legal/tax decisions; confirm with your tax advisor/CPA.

Reference:
- [Register for sales tax/VAT/GST](https://docs.stripe.com/tax/registering)

## Phase 3: Verify in test mode before live mode

1. Switch Dashboard to **Test mode**.
2. Ensure Tax is enabled in test mode settings as well.
3. Add at least one test registration via Tax settings/registrations.
4. Run checkout scenarios in your app:
  - Taxable US shipping address
  - Non-taxable or different state address
  - Pickup order (if used)
5. In Stripe, verify:
  - Checkout Session has `automatic_tax.enabled=true`
  - Payment/Session tax amounts are non-zero where expected
  - Tax appears in [Tax transactions](https://dashboard.stripe.com/tax/transactions)

References:
- [Automatic tax for Checkout](https://docs.stripe.com/tax/checkout)

## Phase 4: Live mode cutover checklist

1. In Myrivo env:
  - `STRIPE_STUB_MODE=false`
  - `STRIPE_SECRET_KEY` = live key
  - `STRIPE_WEBHOOK_SECRET` = live webhook signing secret
2. In Stripe:
  - Confirm **head office** is correct in live mode.
  - Confirm all required **registrations** are active/scheduled.
  - Confirm default **tax behavior** and preset tax codes.
3. Run one real (or controlled live) transaction and verify tax line items and totals in Stripe.

## Connect-specific decision you must make

Because you use Connect Express, choose one tax-liability model:

### Option A: Platform liable (current behavior)
- Keep current integration as-is.
- Maintain tax settings + registrations on platform account.
- Simpler operationally, but platform is central tax operator.

### Option B: Connected account liable (future)
- Configure each connected account’s tax settings/registrations (for Express, via Tax Settings/Registrations API or Connect embedded components).
- Update checkout creation to include:
  - `automatic_tax[liability][type]=account`
  - `automatic_tax[liability][account]=<CONNECTED_ACCOUNT_ID>`
- If invoice creation/issuer is used, set issuer account consistently per Stripe docs.

Reference:
- [Tax for software platforms](https://docs.stripe.com/tax/tax-for-platforms)
- [Checkout Session automatic tax liability](https://docs.stripe.com/api/checkout/sessions/create)

## Current implementation caveat

- Checkout currently sends a single aggregated line item (`<store name> order`) to Stripe.
- For best tax classification, move to itemized line items with explicit product tax codes/tax behavior per item.
