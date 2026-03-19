# Onboarding Rollout Runbook

This runbook covers release quality, acceptance criteria, fallback expectations, and rollout guidance for the preview-first store onboarding system.

It is the release handoff artifact for `myrivo-161`.

## Scope

This runbook applies to:

- `/onboarding`
- `/onboarding/new`
- `/onboarding/store/[storeId]`
- `/onboarding/store/[storeId]/generating`
- `/onboarding/store/[storeId]/reveal`
- the onboarding session APIs
- onboarding generation and milestone tracking
- post-preview launch-readiness surfaces in the store workspace

## Product outcome

The onboarding experience is considered successful when a new merchant can:

- create a real store as soon as they provide a store name
- move through a calm one-question-at-a-time setup flow
- create a real first draft product during onboarding
- see a generated storefront preview before dealing with payments
- move from preview into Studio, Catalog, payments, and launch readiness without losing momentum

## Release acceptance criteria

### Merchant journey

- Unauthenticated users are redirected to login before entering the onboarding flow.
- `Create Store` from Store Hub routes to `/onboarding`, then into `/onboarding/new`.
- Submitting a store name creates:
  - a real store
  - a resumable onboarding session
  - seeded storefront legal docs
- Resuming `/onboarding/store/[storeId]` restores the last meaningful step and prior answers.
- The first product step creates or updates a real draft product and binds it to the onboarding session.
- Completing the review step moves the merchant into the generating state and then into the reveal.
- The reveal shows:
  - seeded store summary
  - live storefront preview
  - clear actions into Studio, Catalog, payments, and launch readiness

### Launch-readiness handoff

- The workspace banner, header readiness summary, and onboarding resume cards use post-preview launch-readiness language.
- Stores that have launched once do not fall back into the early onboarding tracker.
- Go-live gating still relies on real store state:
  - general settings
  - storefront basics / branding
  - first product
  - payments

### Analytics and observability

- Onboarding sessions record milestone timestamps for:
  - first product completed
  - reveal viewed
  - preview route engagement
  - Studio/Catalog/Payments/Launch handoffs
- Platform analytics can summarize:
  - sessions started
  - generation success / failure
  - reveal view rate
  - preview engagement
  - payments handoff
  - payments connected
  - launch-checklist handoff
  - average time to preview

## Fallback behavior

### AI generation fallback

If the configured provider is unavailable, misconfigured, or returns invalid output:

- the generation service must still produce a starter package through the deterministic fallback provider
- the store must remain usable
- the merchant must still be able to reach the reveal
- the generation run record must preserve provider/model/error context

This is a hard requirement. The onboarding flow must not strand the merchant because the primary AI provider is unavailable.

### Session persistence fallback

If the merchant closes the tab mid-flow:

- the real store remains created
- the onboarding session remains resumable
- previously entered answers remain available
- `/onboarding` must offer a resume path

### Launch-readiness fallback

If the merchant stops after the preview:

- the store remains safely non-live
- Stripe is still deferred until later
- the workspace and launch-readiness surfaces continue the setup cleanly

## UX content review checklist

Review these before release:

- The onboarding tone is creation-first, not admin-first.
- `Create store` appears as soon as the store name is valid.
- Skip language does not sound punitive or incomplete.
- The generating step feels active and purposeful, not like a dead wait state.
- The reveal feels like a milestone, not a generic success page.
- Post-reveal copy consistently uses:
  - `Customize in Studio`
  - `Add more products`
  - `Connect Stripe`
  - `Review launch checklist`
- Launch-readiness surfaces read as a second phase after preview, not as a contradiction of the onboarding promise.

## Operator QA checklist

### Flow QA

1. Start with a fresh owner account.
2. Create a store from Store Hub.
3. Complete the guided flow with:
   - logo uploaded
   - store description
   - visual direction
   - first product
4. Confirm the generating step completes and lands on the reveal.
5. Open:
   - Studio
   - Catalog
   - Integrations
   - Store overview / launch checklist
6. Return to `/onboarding` and confirm the store is shown as resumable only if launch work remains.

### Fallback QA

1. Run the flow with the primary AI provider disabled or unavailable.
2. Confirm the deterministic fallback still creates:
   - seeded copy
   - theme direction
   - reveal preview
3. Confirm no part of the flow dead-ends on provider failure.

### Analytics QA

1. Complete a fresh onboarding flow.
2. Confirm milestone timestamps are written to `store_onboarding_sessions`.
3. Confirm `/api/platform/onboarding/overview` returns non-zero counts after that flow.
4. Confirm preview route engagement increments when `Home`, `Products`, and `About` are viewed in the reveal preview shell.

## Rollout guidance

### Recommended rollout order

1. Apply onboarding schema migrations in the target environment.
2. Deploy the application code.
3. Smoke test:
   - `/onboarding`
   - `/onboarding/new`
   - one full generate -> reveal path
   - `/api/platform/onboarding/overview`
4. Verify the fallback provider path before broad announcement.

### Post-deploy checks

- No auth regressions on onboarding routes
- No broken redirects between onboarding and dashboard surfaces
- First product drafts appear in owner preview
- Reveal actions land on the intended workspace destinations
- Platform onboarding analytics endpoint responds successfully for support/admin users

## Known boundaries

- Legal document authoring remains governed outside AI onboarding generation.
- Stripe connection is intentionally post-preview by default.
- Launch-readiness logic still reflects operational requirements, not just preview quality.

## Recommended next uses of the analytics

After launch, the first dashboards or reviews should look at:

- drop-off by onboarding step
- generation success rate
- reveal-to-Studio conversion
- reveal-to-payments conversion
- payments-handoff to payments-connected conversion
- time to first preview

That is the minimum feedback loop for improving the onboarding product after release.
