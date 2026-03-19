# Onboarding Product Creation Audit

## Purpose

This document audits the current product creation flow and defines what an onboarding-first “create your first product” mini-flow should look like.

This is the discovery output for `myrivo-150`.

## High-Level Conclusion

The current catalog product flow is not wrong. It is just built for ongoing catalog management, not first-run onboarding.

It already supports:

- rich product descriptions
- SEO overrides
- image alt text
- featured flags
- manual or automatic SKU strategy
- structured variants
- nested options
- inventory
- made-to-order configuration
- draft / active / archived lifecycle

That is the right long-term product editor, but it is too heavy for the “help me get my first product into my first store” moment.

The right onboarding design is:

- keep the existing product model and API
- do not build a separate lightweight product persistence layer
- add a thin onboarding-first mini-flow that collects only the highest-value inputs
- map that mini-flow into the existing `/api/products` contract

## Current Entry Point

The store workspace catalog page renders:

- `apps/web/app/dashboard/stores/[storeSlug]/catalog/page.tsx`
- which loads `ProductManager`

The current creation experience is the create flyout inside:

- `apps/web/components/dashboard/product-manager.tsx`

## What The Current Create Flow Asks For

The current create flyout already breaks product creation into steps, but it still exposes a lot of detail.

### Step 1: Product details

The first step asks for:

- title
- rich text description
- slug
- SEO title
- SEO description
- primary image alt text
- featured toggle
- image upload / reordering / replacement
- whether the product has variants

If the product does not have variants, the same step also asks for:

- SKU
- price
- inventory
- made-to-order toggle

### Step 2: Variant details

If variants are enabled, the user then manages:

- option names
- option values
- variant-level or group-level images
- whether the variant has nested options
- per-variant SKU
- per-variant price
- per-variant inventory
- per-variant made-to-order

### Step 3: Nested options

If a variant has a second option layer, the user also manages:

- second-level option naming
- child option values
- child option-level SKU
- child option-level price
- child option-level inventory
- child option-level status / deletion

## Why The Current Flow Is Too Heavy For Onboarding

### 1. It asks for too many low-signal fields too early

For a merchant just trying to get a first storefront preview, these fields are too early:

- slug
- SEO title
- SEO description
- image alt text
- featured toggle
- SKU strategy
- inventory precision
- made-to-order behavior

These are useful, but they are not the inputs that create confidence or momentum during onboarding.

### 2. It mixes setup with catalog administration

The current editor is optimized for:

- operational correctness
- SKU hygiene
- inventory management
- variant structure maintenance

That is appropriate in Catalog. It is not appropriate as the user’s first product experience during store creation.

### 3. It assumes the merchant already understands the product model

The current flow expects the merchant to reason about:

- whether they need variants
- how many option tiers they need
- whether images belong at product, variant-group, or variant-option level
- whether SKU should be manual or automatic

That is too much model exposure for onboarding.

### 4. The emotional payoff arrives too late

The first product in onboarding is not mainly an inventory object. It is part of the “your store already looks real” reveal.

The ideal onboarding product step should optimize for:

- speed
- confidence
- visual payoff
- enough fidelity to make the storefront preview feel real

## What The Existing Product System Actually Requires

The current create API lives at:

- `apps/web/app/api/products/route.ts`

The key constraints are:

- title is required
- description is required
- the product always resolves down to variants for persistence
- non-variant products are represented as a single default variant
- the API already supports `draft` creation

Important implication:

We do not need a second backend model for onboarding.

A simplified onboarding flow can still create a real product by sending:

- title
- description
- image URLs
- a single default variant
  - price
  - inventory
  - made-to-order
  - optional SKU

and setting the product to `draft`.

## Recommended Onboarding-First Product Mini-Flow

The onboarding mini-flow should be separate from the full catalog flyout.

It should feel like one guided question at a time, and it should collect only what most merchants can answer quickly.

## Proposed Mini-Flow

### Step 1: Product name

Ask:

- “What’s your first product called?”

Required:

- yes

### Step 2: Product photo

Ask:

- “Do you have a product photo?”

Paths:

- upload image
- skip for now

Required:

- no

### Step 3: Short product description

Ask:

- “How would you describe it?”

This should accept a plain-language description, not a full merchandised product page draft.

Required:

- yes

This gives AI enough signal to:

- improve the description
- generate bullets
- draft alt text
- generate SEO phrasing

### Step 4: Price

Ask:

- “What do you plan to charge?”

Required:

- yes for a polished preview

If the user truly does not know, we could optionally allow:

- “I’ll set this later”

but the preview will look much more credible with price set.

### Step 5: Does it have options?

Ask:

- “Does this product come in different versions, like size, scent, or flavor?”

Options:

- no
- yes, one kind of option
- yes, two kinds of options

This is much better than exposing raw variant tiers immediately.

### Step 6A: Single-option branch

If the answer is one option type:

- ask for the option name
  - e.g. `Scent`
- ask for the option values
  - e.g. `Lavender`, `Unscented`, `Frankincense`

Then optionally ask:

- “Do these all have the same price and stock?”

If yes:

- collect one shared price/inventory answer

If no:

- ask per option

### Step 6B: Two-option branch

If the answer is two option types:

- ask for option group one name + values
- ask for option group two name + values

Then use sensible defaults:

- shared price unless changed
- shared inventory unless changed

Only expose the full matrix if the merchant really needs it in onboarding.

### Step 7: Inventory posture

Ask:

- “Do you keep this in stock, or is it made to order?”

Options:

- in stock
- made to order

If in stock:

- ask for quantity

If made to order:

- default inventory to `0`
- set `isMadeToOrder = true`

### Step 8: AI polish confirmation

Before final submit, tell the user we will:

- polish the product description
- prepare storefront-ready copy
- generate image alt text
- format options for the storefront

That creates the right expectation that the system is going to help finish the job.

## What Should Be Removed From Onboarding

The onboarding mini-flow should not ask for these fields directly:

- slug
- SEO title
- SEO description
- image alt text
- featured toggle
- manual SKU editing
- variant image hierarchy management
- variant status controls
- archive/delete flows
- advanced inventory adjustments

These belong in Catalog after the preview reveal.

## What AI Should Fill For The First Product

Based on the merchant’s answers, AI should draft:

- storefront-ready product description
- short merchandised bullets
- image alt text
- SEO title
- SEO description
- product positioning copy
- maybe lightweight badge language if the storefront uses it

This is especially important because the current API requires a description, and a polished first product will make the preview feel dramatically more real.

## How The Mini-Flow Maps Into The Existing Product Model

The onboarding flow should still create a real product through the current API.

### No-variant product

Map into:

- `hasVariants = false`
- one default variant
- title from onboarding
- description from onboarding + AI polish
- image URLs from onboarding
- price from onboarding
- inventory from onboarding
- made-to-order from onboarding
- status = `draft`

### One-option product

Map into:

- `hasVariants = true`
- `variantTiersCount = 1`
- `variantTierLevels = [optionName]`
- one variant per option value
- shared or per-option price/inventory depending on the branch

### Two-option product

Map into:

- `hasVariants = true`
- `variantTiersCount = 2`
- `variantTierLevels = [optionOneName, optionTwoName]`
- generated matrix variants
- shared defaults first, with overrides only if the user gave them

## Recommended Defaults

The onboarding mini-flow should use sensible defaults so the user is not forced into administrative work.

Recommended defaults:

- product status: `draft`
- SKU mode: auto
- slug: auto-generated
- SEO fields: AI-generated
- alt text: AI-generated
- featured: false by default
- one product image is enough for the initial reveal

## Ideal UX Shape

This should not be a compressed version of the current flyout.

It should be:

- one-question-at-a-time
- optimistic
- image-forward
- plain-language
- branchy only when needed

The user should feel like they are describing a product, not filling out an inventory spreadsheet.

## Relationship To The Full Catalog Workspace

The full `ProductManager` should remain the post-onboarding editor for:

- SEO and metadata cleanup
- richer media management
- SKU control
- advanced variant editing
- inventory management
- archive / publish lifecycle

The onboarding product flow should be thought of as:

- a fast front door into the same system
- not a replacement for Catalog

## Final Recommendation

Build a dedicated onboarding-first product mini-flow that:

- asks for only the highest-signal product inputs
- branches into options only when needed
- uses AI to polish the first product aggressively
- creates a real draft product through the existing API
- leaves advanced catalog administration for later

That gives us the best of both worlds:

- a delightful onboarding experience
- one real product model
- no throwaway onboarding data layer

