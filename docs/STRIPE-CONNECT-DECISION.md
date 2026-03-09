# Stripe Connect Account Type Decision

## Options

### Standard

- Merchant has a full Stripe dashboard and relationship with Stripe.
- Lowest compliance and support burden for Myrivo.
- Stripe handles most KYC and payout onboarding directly.
- Good fit for early-stage platform teams.

### Express

- Merchant onboarding is embedded and more branded to Myrivo.
- Better UX control and less context switching for merchants.
- Higher platform responsibility for support and operations.
- Useful when merchant experience needs deeper integration.

## Recommendation for current stage

Start with **Standard** for fastest, lowest-risk launch.

When merchant volume grows and onboarding UX becomes a key differentiator,
add an Express pathway for selected plans or geographies.

## Trigger points to evaluate moving to Express

- Significant merchant drop-off during Stripe-hosted onboarding
- Need for more branded payout and compliance flows
- Team capacity to support increased operational ownership
