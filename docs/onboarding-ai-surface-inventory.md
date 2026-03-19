# Onboarding AI Surface Inventory

## Purpose

This document inventories the current merchant-facing store setup surface and maps what an onboarding AI workflow could draft for the initial version of a new storefront.

This is the discovery output for `myrivo-149`.

## Working Boundary

The onboarding target is intentionally ambitious:

- Assume AI can draft across the full merchant-facing setup surface by default.
- Only carve out surfaces where there is a clear governance or safety reason not to generate content.

For now, the main carve-out is:

- governed legal/privacy policy language
  - platform legal documents
  - storefront legal base templates
  - formal Privacy Policy and Terms & Conditions body copy

AI may still draft adjacent merchant-facing copy around support, shipping, returns, product messaging, SEO, welcome popup, emails, and storefront presentation.

## Current Source Of Truth

The strongest current inventory sources are:

- `apps/web/lib/storefront/settings-inventory.ts`
- `docs/storefront-settings-inventory.md`
- `apps/web/lib/store-editor/storefront-studio.ts`
- `apps/web/lib/store-editor/store-settings-workspace.ts`
- `apps/web/lib/storefront/presentation.ts`
- `apps/web/lib/email-studio/model.ts`

Together, these show that Myrivo already has a wide configuration surface for:

- store identity
- branding/theme
- storefront copy and structure
- merchandising and presentation
- support / fulfillment / policy messaging
- checkout copy
- welcome popup and email capture
- SEO / metadata
- transactional email templates

## High-Level Conclusion

The app already contains enough persisted configuration to support a very polished AI-generated first storefront without inventing a large new schema first.

The onboarding system can mostly focus on:

- collecting better initial inputs
- generating a structured starter package
- mapping that package onto existing store surfaces
- handing the user into preview and refinement

## Surface Classification

The matrix below groups the current surface by whether onboarding should:

- ask the user directly
- derive a deterministic default
- let AI draft the first version
- defer to later operations setup

## 1. Core Store Identity

### Current surface

Primary store identity currently lives in `stores` and related workspace routing:

- store name
- slug
- status / lifecycle
- owner assignment

### Onboarding stance

- User-provided:
  - store name
- Deterministic:
  - slug
  - initial lifecycle status
- AI-draftable:
  - no need for AI on the canonical identity fields themselves

### Why it matters

This is the minimum required input. It should unlock the earliest possible `Create store` moment in the onboarding flow.

## 2. Branding Assets And Theme Tokens

### Current surface

Branding lives primarily in `store_branding`, with downstream resolution through the storefront theme layer:

- logo
- cover / supporting imagery paths
- primary color
- secondary color
- accent color
- theme JSON tokens

Related runtime/theme composition exists in:

- `apps/web/lib/storefront/presentation.ts`
- `apps/web/lib/theme/storefront-theme.ts`

### Onboarding stance

- User-provided:
  - logo upload, if available
  - optional visual preference or style direction
- AI-draftable:
  - theme direction
  - palette suggestions
  - typography choice
  - page width
  - corner radius
  - density / spacing
  - hero layout
  - footer/header treatment
  - product grid defaults
- Deterministic:
  - sensible fallback theme if AI is unavailable

### Why it matters

This is one of the biggest contributors to the “instant wow” moment. The system already supports enough theme-level configurability to make the generated store feel intentional rather than generic.

## 3. Storefront Copy And Page Presentation

### Current surface

The current storefront experience is composed from:

- `store_settings.storefront_copy_json`
- `store_experience_content`
- `store_branding.theme_json`

The Studio surface already treats the storefront as a structured, editable presentation system:

- `home`
- `products`
- `about`
- `policies`
- `cart`
- `orderSummary`
- `emails`

The runtime resolver in `apps/web/lib/storefront/presentation.ts` already merges:

- home copy
- product page copy
- about copy
- policies copy
- cart copy
- order summary copy
- email copy

### Onboarding stance

- User-provided:
  - short description of the store and what it sells
  - optional style preference
- AI-draftable:
  - homepage hero headline
  - homepage subcopy
  - hero badges
  - fulfillment message
  - announcement copy
  - content blocks
  - product page headline / supporting copy
  - about page title and intro
  - policies page title / subtitle / section headings
  - cart / checkout framing copy
  - order summary reinforcement copy
- Deterministic:
  - fallback section visibility defaults

### Why it matters

This is the main storytelling layer of the storefront. The existing model is already structured enough that AI can populate it in a controlled way instead of dumping raw prose into arbitrary blobs.

## 4. Support, Fulfillment, And Merchant-Facing Operational Copy

### Current surface

`store_settings` already stores operational customer-facing copy such as:

- `support_email`
- `fulfillment_message`
- `shipping_policy`
- `return_policy`
- `footer_tagline`
- `footer_note`
- `policy_faqs`

The policies editor also exposes:

- shipping copy
- returns copy
- support email
- FAQ question/answer blocks

### Onboarding stance

- User-provided:
  - support email if available
  - maybe fulfillment style only if the merchant wants to specify it early
- AI-draftable:
  - shipping policy draft
  - return policy draft
  - policy FAQ starter set
  - footer tagline
  - footer note
  - fulfillment reassurance copy
  - support framing copy
- Deterministic:
  - placeholder support email fallback from account/store data if necessary

### Why it matters

A polished store feels complete when these surfaces are not empty. These are good candidates for AI because they are merchant-facing but not part of the governed legal document system.

## 5. About Page And Editorial Content

### Current surface

The about experience is already modeled with:

- `about_article_html`
- `about_sections`
- related copy in `storefront_copy_json`

### Onboarding stance

- User-provided:
  - store description
  - optional founding story or mission
- AI-draftable:
  - about intro
  - longer editorial body
  - section headings
  - story blocks
  - mission / values framing
- Deterministic:
  - fallback about section structure if the description is sparse

### Why it matters

This is one of the easiest ways for onboarding to create emotional polish fast.

## 6. SEO And Share Metadata

### Current surface

General/store settings already include:

- `seo_title`
- `seo_description`
- social/share metadata fields
- favicon / icon / share image related fields

### Onboarding stance

- User-provided:
  - none required beyond store description
- AI-draftable:
  - SEO title
  - SEO description
  - social summary text
  - metadata defaults for the home page
- Deterministic:
  - fallback title / description built from store name + category description

### Why it matters

This is low-friction polish and should absolutely be part of the generated starter package.

## 7. Footer, Socials, And Newsletter Capture

### Current surface

Footer and growth settings already support:

- footer nav item visibility
- newsletter module visibility
- email capture copy
- social URLs
- footer utility toggles

Relevant current fields include:

- `email_capture_enabled`
- `email_capture_heading`
- `email_capture_description`
- `email_capture_success_message`
- `instagram_url`
- `facebook_url`
- `tiktok_url`
- footer theme/nav toggles in theme JSON

### Onboarding stance

- User-provided:
  - social handles if the merchant wants to provide them
- AI-draftable:
  - email capture heading
  - email capture description
  - success message
  - footer nav defaults
  - footer support tagline
- Deterministic:
  - newsletter enabled/disabled default
  - default footer nav selection

### Why it matters

This makes the footer feel intentional rather than empty. It is also an easy place to create a store-specific brand voice quickly.

## 8. Welcome Popup / Lead Capture Campaign

### Current surface

The storefront already supports a welcome popup with configurable fields:

- enabled state
- eyebrow
- headline
- body
- email placeholder
- CTA label
- decline label
- image layout
- delay seconds
- dismiss days
- associated promotion

### Onboarding stance

- User-provided:
  - maybe whether the merchant wants this enabled by default
- AI-draftable:
  - popup eyebrow
  - popup headline
  - popup body
  - CTA label
  - decline label
  - placeholder text
  - suggested image layout
- Deterministic:
  - safe timing defaults
  - disabled if no promotion / no email strategy is ready

### Why it matters

This is a high-impact “looks finished” surface, and the copy requirements are narrow enough that AI should do well here.

## 9. Email Studio Templates

### Current surface

Email Studio already has a structured template system with themed, editable documents.

Current template IDs:

- `welcomeDiscount`
- `customerConfirmation`
- `ownerNewOrder`
- `pickupUpdated`
- `shippingDelay`
- `refundIssued`
- `disputeOpened`
- `disputeResolved`
- `failed`
- `cancelled`
- `shipped`
- `delivered`

Each template can currently express structured fields like:

- subject
- preheader
- headline
- body HTML
- CTA label
- CTA URL
- footer note

The studio also supports:

- sender name
- reply-to email
- email theme

### Onboarding stance

- User-provided:
  - maybe sender name / support reply-to if available
- AI-draftable:
  - welcome discount email copy
  - customer confirmation tone and messaging
  - owner new order email framing
  - shipment / delay / refund copy tone
  - footer notes
  - template theme polish
- Deterministic:
  - operational token structure
  - basic CTA URLs

### Why it matters

If onboarding can seed these templates, the merchant’s operational surface looks much more complete on day one. This is a major differentiator and fits the “no half measures” goal.

## 10. Product Presentation Defaults

### Current surface

The storefront theme and products-page experience already support presentation controls such as:

- product grid columns
- filter layout
- search / sort visibility
- option filters
- product card description visibility and line limits
- quick add
- carousel controls
- image fit
- featured products limit
- review presentation toggles

### Onboarding stance

- User-provided:
  - maybe broad catalog style preference only
- AI-draftable:
  - recommended layout defaults based on store type
  - recommended card density
  - recommended featured product count
  - review module defaults
  - search/filter posture
- Deterministic:
  - fallback defaults if the AI result is missing

### Why it matters

These settings shape the feel of the storefront almost as much as color and copy do.

## 11. First Product And Product Copy

### Current surface

The current full product creation flow is feature-rich but heavy for onboarding.

What matters for this bead is that the product model already supports:

- product name
- description
- pricing
- imagery
- variants/options
- merchandising flags

### Onboarding stance

- User-provided:
  - first product basics
- AI-draftable:
  - product description polish
  - product bullets
  - product imagery alt text
  - SEO-ready phrasing
  - merchandising positioning
- Deterministic:
  - basic product defaults if the merchant skips optional details

### Why it matters

The first product should feel showroom-ready quickly. The onboarding flow should likely use a simplified product step, but the generated enrichment can still target the real product model.

## 12. Checkout, Shipping, And Pickup Presentation

### Current surface

The store settings model already supports customer-facing checkout copy and toggles such as:

- local pickup label
- pickup fee defaults
- flat rate shipping label
- shipping fee defaults
- order note prompt

### Onboarding stance

- User-provided:
  - usually not necessary in first-run onboarding
- AI-draftable:
  - pickup label wording
  - flat-rate shipping label wording
  - order note prompt
  - gentle fulfillment reassurance copy
- Deterministic:
  - operational defaults for enabled/disabled behaviors
- Defer:
  - real pickup locations
  - schedules
  - provider and fulfillment operations

### Why it matters

The copy can be generated early, while the true operational details can stay in later setup.

## 13. Domains, Team, Billing, And Integrations

### Current surface

These sections exist in store settings as operational workspaces:

- domains
- team
- billing
- integrations

### Onboarding stance

- User-provided:
  - Stripe connection is the key onboarding action here
- AI-draftable:
  - none of consequence
- Deterministic:
  - no
- Defer:
  - custom domain verification
  - team invites
  - billing administration
  - provider operations

### Why it matters

These are important to launch, but they are not a good target for generative drafting. They should stay operational.

## 14. Legal And Privacy Boundary

### Current surface

The current model intentionally separates:

- platform legal docs
- storefront legal base templates
- store-specific legal variables and addenda
- privacy request/contact fields

### Onboarding stance

- AI should not author:
  - governed Privacy Policy language
  - governed Terms & Conditions language
  - platform legal baselines
  - storefront legal base templates
- AI may potentially assist later with:
  - non-binding support/help copy surrounding privacy workflows
  - merchant guidance copy in internal UX

### Why it matters

This is the main hard boundary for the onboarding generation system.

## Draftability Summary

### Strong AI candidates on day one

- theme direction and presentation defaults
- homepage copy
- about copy
- announcement / fulfillment copy
- footer tagline and note
- policy FAQ starter content
- shipping / returns draft copy
- SEO metadata
- newsletter capture copy
- welcome popup copy
- transactional email template copy
- first-product copy enrichment

### Better as deterministic defaults

- slug
- lifecycle status
- basic section visibility
- safe timing values
- fallback CTA URLs
- base operational toggles when no merchant signal exists

### Better deferred to later operations setup

- custom domains
- team invites
- billing details
- real pickup locations and schedules
- payment connection completion

### Explicit exclusions

- platform legal documents
- storefront legal base templates
- formal Privacy Policy document body
- formal Terms & Conditions document body

## Ideal Starter Package Produced By Onboarding

The onboarding generation pipeline should aim to produce one structured starter package with at least:

- brand direction
- storefront theme tokens
- home page copy
- about page copy
- policy/support copy
- SEO defaults
- footer/newsletter/welcome popup copy
- email template theme and copy
- first-product enrichment
- product presentation defaults
- checkout-facing copy defaults

## Implication For UX Planning

Because the current surface is so broad, the onboarding workflow does not need to ask the user for every setting directly.

The better model is:

- ask for a small set of high-signal inputs
- let AI draft the broad starter package
- let the merchant refine the result in Studio, Catalog, Email Studio, and Store Settings after preview

That means the next UX design bead should optimize for:

- minimal question count
- high-signal prompts
- strong preview reveal
- confidence that the generated result is already surprisingly complete

