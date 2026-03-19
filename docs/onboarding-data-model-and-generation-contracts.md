# Onboarding Data Model And Generation Contracts

## Purpose

This document defines the onboarding data model, resumability contract, and generation snapshot contract for the ideal Myrivo onboarding experience.

This is the design output for `myrivo-153`.

It builds on:

- `docs/onboarding-ux-ia-design.md`
- `docs/onboarding-copy-and-pacing-design.md`
- `docs/onboarding-ai-surface-inventory.md`
- `docs/onboarding-product-creation-audit.md`

## Design Goal

The onboarding system needs to support five things at once:

1. create the real store early
2. preserve progress across sessions
3. allow AI generation to operate on structured data
4. persist generated results into the real store system
5. keep enough provenance and snapshotting that we can recover, debug, and regenerate safely

This means onboarding cannot just be a client-side wizard. It needs a real persistence and contract layer.

## High-Level Architecture

The ideal model has three layers:

## Layer 1: Real store system

The app continues to use the existing source-of-truth tables for the actual merchant-facing store:

- `stores`
- `store_branding`
- `store_settings`
- `store_experience_content`
- `products`
- `product_variants`
- `store_legal_documents`
- transactional email content via the existing experience / email model

These remain the canonical runtime surfaces.

## Layer 2: Onboarding session state

A dedicated onboarding session stores:

- where the user is in the flow
- what answers they have given so far
- whether generation is pending, running, failed, or complete
- what reveal state exists

This is the resumability layer.

## Layer 3: Generation snapshot

A structured generation snapshot stores:

- the normalized AI input package
- the structured generated output
- generation status and provenance
- what version was last applied to the real store surfaces

This is the orchestration and audit layer.

## Key Design Decision

The store should be created early, but onboarding progress should not live only in the live store tables.

Why:

- the merchant may abandon the flow midway
- not every answer should be immediately sprayed into runtime surfaces before generation
- we need to support resume, retry, and regenerate cleanly

So the real store exists early, but onboarding state needs its own explicit persistence model.

## Proposed New Persistence Objects

## 1. `store_onboarding_sessions`

Recommended purpose:

- one active onboarding session per store
- resumable state for the guided flow

Recommended fields:

- `id`
- `store_id`
- `owner_user_id`
- `status`
  - `in_progress`
  - `generation_pending`
  - `generation_running`
  - `generation_failed`
  - `reveal_ready`
  - `completed`
  - `abandoned`
- `current_step`
  - string or enum matching the guided flow step
- `last_completed_step`
- `started_at`
- `updated_at`
- `completed_at`
- `last_seen_at`
- `generation_requested_at`
- `generation_completed_at`
- `generation_failed_at`
- `generation_error_code`
- `generation_error_message`

Recommended constraints:

- unique active session per `store_id`
- index by `owner_user_id`
- index by `status`

## 2. `store_onboarding_answers`

Recommended purpose:

- persist the merchant’s raw and normalized answers independently of generated output

Recommended fields:

- `store_id`
- `session_id`
- `answers_json`
- `normalized_answers_json`
- `step_progress_json`
- `updated_at`

Recommended content in `answers_json`:

- store name confirmation
- logo asset references
- store description
- visual preference
- first product raw answers
- “connect Stripe later” choice
- skip/defer flags

Recommended content in `normalized_answers_json`:

- cleaned text inputs
- structured theme preference
- normalized product branch selections
- normalized product option arrays
- normalized pricing / inventory posture

Recommended content in `step_progress_json`:

- started steps
- completed steps
- skipped steps
- timestamps

## 3. `store_onboarding_generation_runs`

Recommended purpose:

- record each generation attempt and its structured inputs/outputs

Recommended fields:

- `id`
- `store_id`
- `session_id`
- `status`
  - `pending`
  - `running`
  - `succeeded`
  - `failed`
  - `partially_applied`
- `model`
- `provider`
- `input_json`
- `output_json`
- `applied_snapshot_json`
- `error_code`
- `error_message`
- `started_at`
- `completed_at`

Why separate runs from the session:

- supports regeneration
- supports retries
- preserves provenance
- makes debugging safer

## Onboarding Lifecycle

## Stage 1: Early store creation

As soon as the merchant gives a valid store name:

- create the `stores` row
- create default `store_branding`
- create default `store_settings`
- seed legal baseline as we do today
- create the active onboarding session
- write the first answer payload

This is the point where the merchant can leave and safely come back later.

## Stage 2: Guided answer capture

As the user moves through the wizard:

- write updates into `store_onboarding_answers`
- update `current_step` and `last_completed_step`
- store asset references like uploaded logo or product image IDs/paths

Important rule:

- do not necessarily persist every answer immediately into live storefront surfaces
- preserve onboarding intent first

## Stage 3: First product creation

When the user completes the onboarding product mini-flow:

- create or update a real draft product through the existing product API
- store the created product ID inside the onboarding session or answer payload

Recommended:

- persist `first_product_id` in `store_onboarding_sessions`
  or
- include it in `step_progress_json`

This keeps the product real while still making the onboarding flow resumable.

## Stage 4: Generation request

When the flow reaches “Build your storefront”:

- normalize the answer payload into a structured input contract
- create a `store_onboarding_generation_runs` row
- mark the session as `generation_pending` or `generation_running`

## Stage 5: Generation apply

When generation succeeds:

- persist the generated snapshot
- apply the generated values into the real store surfaces
- mark the session as `reveal_ready`

## Stage 6: Reveal and post-reveal continuation

When the user reaches reveal:

- store the reveal timestamp
- keep the session resumable
- allow post-reveal actions to move the session toward `completed`

Recommended `completed` meaning:

- the user has reached the reveal at least once
- not necessarily that Stripe is connected or the store is launch-ready

## Structured Answer Contract

The onboarding answer model should be richer than “form field dump.”

Recommended top-level answer contract:

```json
{
  "storeIdentity": {
    "storeName": "Sunset Mercantile"
  },
  "branding": {
    "logoAssetPath": "...",
    "visualDirection": "natural_wellness",
    "visualDirectionSource": "user"
  },
  "storeProfile": {
    "description": "...",
    "audience": "...",
    "positioning": "..."
  },
  "firstProduct": {
    "status": "created",
    "productId": "...",
    "input": {
      "title": "...",
      "description": "...",
      "imagePaths": ["..."],
      "pricingMode": "set",
      "priceCents": 2400,
      "optionMode": "single_axis",
      "axes": [
        { "name": "Scent", "values": ["Lavender", "Unscented"] }
      ],
      "inventoryMode": "made_to_order"
    }
  },
  "payments": {
    "connectDeferred": true
  }
}
```

Important qualities:

- human-readable
- normalized enough for deterministic generation input
- flexible enough for future onboarding step changes

## Structured Generation Input Contract

The generation input should not be “raw answers only.” It should be a normalized, explicit, server-side contract.

Recommended top-level input contract:

```json
{
  "store": {
    "id": "...",
    "name": "Sunset Mercantile",
    "slug": "at-home-apothecary"
  },
  "merchantAnswers": {
    "...": "..."
  },
  "availableAssets": {
    "logoPath": "...",
    "productImagePaths": ["..."]
  },
  "firstProductContext": {
    "productId": "...",
    "title": "...",
    "description": "...",
    "hasOptions": true
  },
  "generationScope": {
    "home": true,
    "about": true,
    "policiesSupportCopy": true,
    "theme": true,
    "seo": true,
    "welcomePopup": true,
    "emailStudio": true,
    "productEnrichment": true
  }
}
```

Why this matters:

- gives the model a stable interface
- keeps generation deterministic and inspectable
- avoids leaking UI-specific wizard state directly into the prompt layer

## Structured Generation Output Contract

The generation output must be explicitly structured and directly mappable to the current system.

Recommended top-level output contract:

```json
{
  "branding": {
    "primaryColor": "#...",
    "accentColor": "#...",
    "themeJson": {}
  },
  "storeSettings": {
    "supportEmail": "...",
    "fulfillmentMessage": "...",
    "shippingPolicy": "...",
    "returnPolicy": "...",
    "announcement": "...",
    "seoTitle": "...",
    "seoDescription": "...",
    "footerTagline": "...",
    "footerNote": "...",
    "emailCapture": {},
    "welcomePopup": {}
  },
  "storeExperienceContent": {
    "home": {},
    "productsPage": {},
    "aboutPage": {},
    "policiesPage": {},
    "cartPage": {},
    "orderSummaryPage": {},
    "emails": {}
  },
  "emailStudio": {
    "senderName": "...",
    "replyToEmail": "...",
    "theme": {},
    "templates": {}
  },
  "firstProductEnrichment": {
    "productId": "...",
    "description": "...",
    "imageAltText": "...",
    "seoTitle": "...",
    "seoDescription": "..."
  }
}
```

Important rule:

- this should be output schema, not freeform prose

## Persistence Mapping

## `stores`

Persist or update:

- store name
- slug
- lifecycle status

No broad AI content should be written here beyond identity fields.

## `store_branding`

Persist:

- logo path
- primary / accent colors
- theme token JSON

## `store_settings`

Persist:

- support email
- fulfillment message
- shipping policy
- return policy
- announcement
- SEO fields
- footer tagline
- footer note
- newsletter capture defaults
- welcome popup fields
- checkout-facing copy defaults

## `store_experience_content`

Persist:

- home section content
- products page content
- about page content
- policies page content
- cart content
- order summary content
- email-related experience content when applicable

## `products` and `product_variants`

The first product should already exist as a real draft product before generation.

Generation then updates:

- description
- image alt text
- SEO title
- SEO description
- possibly merchandising flags later if needed

Recommended rule:

- onboarding should not regenerate the entire product object from scratch if a real product ID already exists
- generation should enrich the existing product

## Email content persistence

The existing Email Studio model is structured enough that generation output should be serialized into the same section/document format used by Email Studio.

That means onboarding does not need a second email-copy persistence model.

## What Should Be Snapshotted

We should preserve enough snapshot history to support:

- debugging
- regeneration
- content provenance
- future UI explaining “what onboarding created”

Recommended snapshots:

- raw answers snapshot
- normalized answer snapshot
- generation input snapshot
- generation output snapshot
- applied snapshot

This does not necessarily require separate tables for all of them if the generation runs record holds them cleanly, but the data must be preserved.

## Generation Status Model

The session and generation run states should be simple and explicit.

Recommended session states:

- `in_progress`
- `generation_pending`
- `generation_running`
- `generation_failed`
- `reveal_ready`
- `completed`
- `abandoned`

Recommended generation run states:

- `pending`
- `running`
- `succeeded`
- `failed`
- `partially_applied`

## Resume Semantics

The user should be able to resume from:

- the last unanswered step
- the product mini-flow branch they were in
- the generation state if they closed during generation
- the reveal screen after generation completed

Recommended logic:

- if session is `in_progress`, route to `current_step`
- if session is `generation_pending` or `generation_running`, route to generating
- if session is `reveal_ready`, route to reveal
- if session is `completed`, show reveal or route to Store Hub / preview-ready summary

## Failure Model

The system should degrade gracefully.

### If answer persistence fails

- stop the step transition
- keep the merchant on the current step

### If generation fails before apply

- keep the store and first product intact
- mark session `generation_failed`
- allow retry
- allow “continue with defaults”

### If generation partially applies

- mark run `partially_applied`
- preserve the applied snapshot
- let the user continue to reveal or to manual customization

## Legal And Governance Boundary

The generation contract must explicitly exclude governed legal/privacy policy body generation.

That means the generation output schema should not include:

- legal document markdown bodies
- privacy policy markdown bodies
- terms-and-conditions markdown bodies

It may still include:

- support/help copy adjacent to those experiences
- policies page framing and FAQ text

## Recommended Minimal V1 Schema Additions

If we want the cleanest implementation, the minimum new persistence should be:

- `store_onboarding_sessions`
- `store_onboarding_answers`
- `store_onboarding_generation_runs`

Everything else should map into the existing store system.

That is a strong sign that the architecture is in a good place:

- add a thin orchestration layer
- keep the canonical runtime surfaces intact

## Final Recommendation

The onboarding system should:

- create the real store early
- preserve merchant answers in a resumable onboarding layer
- create the first product as a real draft product
- build one structured generation input contract
- receive one structured generation output contract
- apply that output into existing store runtime surfaces
- preserve provenance and snapshots for retry, debug, and future regeneration

This gives us:

- a durable wizard
- a debuggable AI pipeline
- a preview-first experience
- and one real source of truth for the final store
