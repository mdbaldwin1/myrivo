# Onboarding UX And IA Design

## Purpose

This document defines the ideal onboarding user experience, information architecture, and step architecture for Myrivo store creation.

This is the design output for `myrivo-151`.

It synthesizes:

- the current-state onboarding audit
- the AI surface inventory
- the product creation audit

## Design Goal

The onboarding experience should make a new merchant feel, within minutes:

- “I already have a real store”

not:

- “I created an empty container and now I have to configure everything manually”

The product outcome we want is:

- a guided, low-friction setup flow
- one clear question at a time
- broad AI-assisted drafting across the merchant-facing surface
- a short “generation” moment
- a reveal into a polished storefront preview
- a clean handoff into the existing workspace for refinement and launch readiness

## Core Product Principles

### 1. Create momentum before asking for administration

The onboarding front door should optimize for:

- confidence
- progress
- visual payoff

It should not start by asking the merchant to think like an operator.

### 2. Ask only for high-signal inputs

The flow should gather a small set of inputs that unlock the broadest possible generated starter package.

Examples:

- store name
- logo
- store description
- style direction
- first product

### 3. Create early, refine later

Only the store name should be truly required to create the store record.

After that point:

- the merchant can keep going through guided setup
- or stop and return later

### 4. Use one real system, not onboarding-only shadow models

Onboarding should create:

- a real store
- real storefront content/settings
- real theme defaults
- a real first product

It should not create throwaway onboarding-only objects that later need to be reconciled.

### 5. Preview is the reward

The natural culmination of onboarding should be a storefront reveal, not a dashboard landing page.

## Proposed Information Architecture

The onboarding experience should become its own product surface with three phases:

## Phase 1: Guided Setup

The user answers a one-question-at-a-time workflow that gathers the minimum high-signal inputs.

## Phase 2: Store Generation

The system:

- creates or updates the real store
- runs one structured generation pass
- persists the starter package
- prepares the preview

## Phase 3: Preview And Handoff

The user lands in a storefront-first reveal screen with guided next actions into:

- Storefront Studio
- Catalog
- Email Studio
- Payments / Stripe connect
- launch readiness

## Route And Surface Architecture

## Keep `/onboarding`, but repurpose it

Today `/onboarding` is a bootstrap + checklist page.

It should become the main guided setup entry.

## Recommended route model

- `/onboarding`
  - landing / resume surface
- `/onboarding/new`
  - guided onboarding flow shell
- `/onboarding/store/[storeId]`
  - resumable guided flow for an in-progress store
- `/onboarding/store/[storeId]/generating`
  - generation/progress state
- `/onboarding/store/[storeId]/reveal`
  - preview-first reveal screen

This keeps the flow explicit and resumable.

## Recommended relationship to Store Hub

`Create Store` from Store Hub should route to:

- `/onboarding/new`

not directly into the workspace.

Store Hub should still remain the place where users can:

- see all stores
- resume incomplete onboarding
- jump into existing workspaces

But the act of creating a new store should use the dedicated onboarding product.

## Recommended relationship to the workspace

The workspace should no longer be the immediate post-create landing experience.

Instead:

- onboarding creates the real store
- onboarding ends in preview / reveal
- the workspace becomes the refinement surface after the reveal

This is a major but correct separation.

## Step Architecture

The guided setup should ask one clear question at a time.

Each step should have:

- one primary question
- one supporting explanation
- one clear CTA
- skip when appropriate

## Proposed ideal step sequence

### Step 1: Store name

Question:

- “What’s the name of your store?”

Behavior:

- this is the only truly required field
- as soon as the user completes it, the store can be created

Primary CTA:

- `Create store`

Secondary CTA once store name is valid:

- `I’ll figure the rest out later`

Meaning:

- create the draft store immediately
- allow the flow to continue or be paused

## Step 2: Logo

Question:

- “Do you have a logo?”

Paths:

- upload logo
- skip for now

Why:

- this is a high-value visual signal
- but it should never block progress

## Step 3: Describe your store

Question:

- “Can you describe your store and the kinds of products you want to sell?”

This should be the highest-value generative input in the whole flow.

It should power:

- homepage copy
- about copy
- support/fulfillment tone
- SEO
- product merchandising language

## Step 4: Visual direction

Question:

- “What kind of look do you want?”

Options should be merchant-friendly, not designer-jargon-heavy.

Recommended options:

- Minimal / clean
- Warm / handmade
- Natural / wellness
- Bold / modern
- Premium / elevated
- Let AI choose

This should shape:

- colors
- typography
- page width
- spacing/radius
- hero layout
- product grid density

## Step 5: First product

This should be the onboarding-first mini-flow described in `onboarding-product-creation-audit.md`.

Recommended inner sequence:

- product name
- photo
- plain-language description
- price
- options branch if needed
- stock vs made-to-order

This step should create a real draft product through the existing product API.

## Step 6: Generate your storefront

This is not a form step. It is the generation phase.

The app should present a short, intentional progress experience while it:

- generates copy
- applies theme defaults
- enriches the first product
- seeds email copy
- prepares the storefront preview

## Step 7: Preview reveal

This is the emotional payoff.

The merchant should see:

- a polished storefront preview
- a sense that the store already exists

Primary CTA:

- `Customize in Studio`

Secondary CTAs:

- `Add more products`
- `Connect Stripe`
- `Review launch checklist`

## Stripe connection should be post-reveal by default

Stripe should not be part of the default path before preview.

Why:

- it introduces operational complexity too early
- it delays the moment where the merchant sees value
- it shifts the flow from creation into administration before the reveal

Recommended approach:

- keep Stripe out of the main pre-preview step sequence
- surface it prominently on the reveal screen
- keep it in launch readiness and go-live gating
- message clearly that payments can be connected after preview and before launch

## Branching Rules

The onboarding flow should stay linear by default, but branch only where needed.

## Branch 1: Early create

Once the store name is valid:

- the store can be created immediately
- the user can continue the guided flow
- or stop and resume later

This means creation and completion are no longer the same event.

## Branch 2: Logo skip

Logo should be optional.

If skipped:

- use a branded fallback treatment
- still let AI generate the rest of the visual identity

## Branch 3: Theme preference

If the user picks:

- `Let AI choose`

then the system should generate the initial design direction entirely from the store description and product context.

## Branch 4: Product options

The first product step should branch only when the merchant says the product has options.

That keeps the common path very light.

## Branch 5: Stripe connection

Stripe should be treated as a post-reveal activation task, not a pre-preview setup step.

The merchant should always be able to reach the reveal screen without connecting payments first.

## Resumability Model

The onboarding flow should be resumable at any point after store creation.

The user should be able to:

- close the flow
- come back later
- continue from the last meaningful step

That implies an onboarding session/state model with:

- current step
- captured answers
- generation status
- last completed milestone

This should be separate from launch-readiness computation.

## Relationship To Launch Readiness

We should keep the current launch-readiness idea:

- profile
- branding
- first product
- payments
- launch

But reposition it as a post-bootstrap readiness model, not the primary onboarding UX.

So the new mental model becomes:

- guided onboarding gets the merchant to a strong first storefront preview
- launch readiness gets the merchant to a safe, operationally complete live store

That is a much cleaner product split.

## Recommended Post-Onboarding Surfaces

After the reveal, the user should not fall back into a vague empty dashboard.

Instead, the reveal screen should present the next actions clearly.

## Recommended next-action destinations

- `Customize design`
  - Storefront Studio
- `Add more products`
  - Catalog
- `Review emails`
  - Email Studio
- `Connect payments`
  - Integrations / Payments
- `Prepare to launch`
  - store dashboard / launch checklist

## Handoff hierarchy

The reveal screen should be the bridge between:

- the guided onboarding product
- the broader store workspace

That means it should remain in the onboarding area, not instantly drop the user into a dashboard page.

## Recommended Layout Model

## Setup flow shell

The ideal flow shell should be:

- centered
- calm
- one question at a time
- visually more premium than the current utility-style form

Recommended persistent elements:

- progress indicator
- store name
- save/resume state
- exit / continue later affordance

## Reveal screen

The reveal should feel like a milestone, not a generic success message.

Recommended elements:

- “Your store is ready to preview”
- embedded or adjacent storefront preview
- short summary of what was created
- next-action cards

## Generation Layer Architecture

The onboarding system should produce one structured starter package.

It should include:

- brand direction
- theme tokens
- home/about/footer/support copy
- policies/support draft copy
- SEO defaults
- welcome popup / email capture copy
- Email Studio copy/theme
- first-product enrichment
- product presentation defaults

It should not include:

- governed legal/privacy document language

## AI Invocation Model

The UX should assume:

- one primary structured generation call after the user has answered enough questions

not:

- constant AI invocation on every field change

This keeps:

- cost down
- latency understandable
- behavior more deterministic

## Error And Fallback UX

The onboarding flow must not feel fragile.

If generation fails:

- the store should still exist
- the first product should still exist if entered
- deterministic defaults should still produce a usable preview
- the UI should message:
  - “We created your store. A few generated details didn’t finish, but you can keep going.”

This is critical.

## Ideal End State For `/onboarding`

The final `/onboarding` experience should act as:

- a resume dashboard for in-progress onboarding
- a launchpad for new store creation
- a place to continue unfinished guided setup

It should no longer be:

- a one-field bootstrap form plus a checklist card

## Design Summary

The ideal onboarding architecture is:

- create the store as soon as the merchant gives a name
- continue through a guided, one-question-at-a-time setup
- collect a small number of high-signal inputs
- generate a broad starter storefront package
- create a real first product through the existing product API
- optionally connect Stripe
- reveal the result through storefront preview
- hand the user into Studio, Catalog, Email Studio, and launch-readiness surfaces from there

## Implementation Implications

This bead implies the next design and implementation work should focus on:

- onboarding copy and pacing
- onboarding session/state model
- generation contracts
- guided flow shell
- preview/reveal surface
- post-reveal handoff

The main product decision is now clear:

- onboarding should be a dedicated product experience
- not a thin layer over the existing dashboard
