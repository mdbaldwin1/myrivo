# Onboarding Copy And Pacing Design

## Purpose

This document defines the copy system, emotional pacing, and preview handoff language for the ideal Myrivo onboarding experience.

This is the design output for `myrivo-152`.

It builds on:

- `docs/onboarding-ux-ia-design.md`
- `docs/onboarding-ai-surface-inventory.md`
- `docs/onboarding-product-creation-audit.md`

## Core Tone Goal

The onboarding tone should feel:

- confident
- calm
- polished
- helpful
- momentum-building

It should not feel:

- operational
- bureaucratic
- checklist-heavy
- admin-first

The merchant should feel like Myrivo is helping them create something exciting, not asking them to complete internal setup paperwork.

## Tone Principles

### 1. Prefer creation language over configuration language

Use language like:

- create
- shape
- build
- preview
- polish
- make it yours

Avoid leading with:

- configure
- complete
- finalize
- management workspace
- administration

### 2. Keep each step emotionally narrow

Each step should ask for one thing and make the value of that thing obvious.

Bad feeling:

- “I have to fill out a lot before I can move on.”

Target feeling:

- “That was easy. What’s next?”

### 3. The system should sound capable

The user is trusting the system to do meaningful work after just a few inputs.

The copy should signal:

- we can take it from here
- you can refine later
- this does not need to be perfect yet

### 4. Never imply the user must finish everything now

The merchant should feel safe skipping, pausing, and returning later.

That means the copy should repeatedly reinforce:

- create now
- refine later
- preview first
- connect operations before launch, not before value

## Overall Pacing Model

The onboarding experience should have four emotional phases:

## Phase 1: Invitation

The user should feel:

- this will be quick
- I do not need everything ready
- I can get to something real fast

## Phase 2: Momentum

The user should feel:

- each answer is moving the store forward
- the questions are smart and manageable
- the system is doing more work than they are

## Phase 3: Anticipation

During generation, the user should feel:

- something substantial is happening
- the app is using their input well
- the preview will be worth waiting for

## Phase 4: Reward

At reveal, the user should feel:

- impressed
- proud
- excited to refine

This is the most important emotional moment in the whole flow.

## Entry Copy

## `/onboarding` landing intent

The current page reads like:

- workspace bootstrap
- checklist
- existing stores

The future page should read like:

- create a new store quickly
- resume a store you were building
- get to a preview fast

## Recommended landing headline

- `Create your store`

## Recommended landing description

- `Answer a few questions and we’ll build a polished first version of your storefront for you.`

Alternative:

- `Tell us a little about your store and we’ll turn it into a preview you can start customizing right away.`

## Recommended support copy near the primary CTA

- `You only need a store name to get started. Everything else can be refined later.`

## Recommended primary CTA

- `Start building`

## Resume section headline

- `Pick up where you left off`

## Resume section description

- `Your stores keep their progress, so you can jump back in anytime.`

## Step Copy Recommendations

Each step should use:

- a short headline
- one supporting sentence
- one main input area
- a clear CTA
- a skip or continue-later path where appropriate

## Step 1: Store name

### Headline

- `What’s the name of your store?`

### Supporting copy

- `This is the only thing you need to create your store. We can help with the rest.`

### Primary CTA before valid input

- `Create store`

### Secondary text after valid input

- `You can keep going or finish the rest later.`

### Continue-later CTA after valid input

- `I’ll finish setup later`

### Success toast copy

- `Store created`

Description:

- `We saved your store and you can keep building from here.`

## Step 2: Logo

### Headline

- `Do you have a logo?`

### Supporting copy

- `If you upload one now, we’ll use it in your storefront preview. If not, we’ll still make the store look polished.`

### Primary CTA

- `Continue`

### Skip CTA

- `Skip for now`

### Empty-state helper copy

- `PNG, JPG, SVG, or WebP all work well.`

## Step 3: Store description

### Headline

- `Tell us about your store`

### Supporting copy

- `What do you sell, who is it for, and what makes it special? We’ll use this to shape your copy, layout, and overall feel.`

### Placeholder

- `We sell small-batch herbal remedies, apothecary goods, and seasonal wellness products with a warm, old-world feel.`

### Primary CTA

- `Continue`

### Helper copy under the field

- `Don’t worry about writing it perfectly. A few honest sentences are enough.`

## Step 4: Visual direction

### Headline

- `What kind of look do you want?`

### Supporting copy

- `Choose a direction, or let us suggest one based on your store.`

### Option labels

- `Minimal`
- `Warm & handmade`
- `Natural & wellness`
- `Bold & modern`
- `Premium`
- `Let AI choose`

### Primary CTA

- `Continue`

### Helper copy

- `You can change the look later in Studio.`

## Step 5: First product intro

### Headline

- `Let’s add your first product`

### Supporting copy

- `One product is enough to make your preview feel real. We’ll help polish the details.`

### Primary CTA

- `Add first product`

### Skip CTA

- `I’ll add products later`

### Skip helper copy

- `You can still preview your store without a product, but it will feel more complete with one.`

## First product subflow copy

## Product name

### Headline

- `What’s your product called?`

### Supporting copy

- `Use the name shoppers would see on your storefront.`

### CTA

- `Continue`

## Product photo

### Headline

- `Do you have a photo for it?`

### Supporting copy

- `Add one if you have it. You can always upload more later.`

### Primary CTA

- `Continue`

### Skip CTA

- `Skip for now`

## Product description

### Headline

- `How would you describe it?`

### Supporting copy

- `A plain-language description is perfect. We’ll turn it into stronger storefront copy.`

### Helper copy

- `You don’t need marketing copy here. Just describe what it is and why someone would want it.`

## Price

### Headline

- `What do you plan to charge?`

### Supporting copy

- `This helps us make the preview feel real.`

### Optional defer CTA

- `I’ll set pricing later`

### Deferred helper copy

- `You can still preview the product, but the storefront will look more complete with a price.`

## Product options

### Headline

- `Does it come in different versions?`

### Supporting copy

- `For example: size, scent, flavor, or color.`

### Option labels

- `No`
- `Yes, one kind of option`
- `Yes, two kinds of options`

### CTA

- `Continue`

## Stock posture

### Headline

- `Do you keep it in stock or make it to order?`

### Supporting copy

- `This helps us set up the first version of the product correctly.`

### Options

- `In stock`
- `Made to order`

### CTA

- `Continue`

## Progress Copy

The progress language should feel directional, not evaluative.

Avoid:

- `Step 2 of 7`
- `Onboarding in progress`
- `3/5 complete`

as the only framing

Recommended pattern:

- a compact numeric progress indicator is fine
- but pair it with directional language

## Recommended progress labels

- `Store basics`
- `Brand look`
- `First product`
- `Building your preview`
- `Your store is ready`

## Recommended top-of-flow progress example

- `Store basics`
- `1 of 5`

Better than:

- `Step 1 of 7`

because it tells the user what kind of progress they’re making.

## Button Language

The CTAs should help the flow feel lightweight.

Prefer:

- `Continue`
- `Skip for now`
- `Create store`
- `Add first product`
- `Build my preview`
- `Customize in Studio`

Avoid heavy labels like:

- `Submit`
- `Save and continue`
- `Complete onboarding`
- `Open management workspace`

## Generation-State Copy

This is one of the highest-leverage copy moments in the whole experience.

It needs to feel like:

- real work is happening
- the wait is worth it
- the app is assembling something thoughtful

## Generation screen headline

- `Building your storefront`

Alternative:

- `Creating your first storefront preview`

## Generation screen supporting copy

- `We’re turning your answers into a polished first version of your store.`

## Recommended rotating progress messages

- `Shaping your store’s look`
- `Drafting your storefront copy`
- `Polishing your first product`
- `Preparing your preview`
- `Getting your store ready to explore`

These are better than technical language like:

- `Applying theme config`
- `Generating content`
- `Saving settings`

## Fallback / slow-generation copy

- `This is taking a little longer than usual, but your store is still being prepared.`

## Failure fallback copy

Headline:

- `Your store is ready, with a few things left to polish`

Body:

- `We created your store successfully. Some generated details didn’t finish, but you can keep customizing and previewing everything.`

Primary CTA:

- `Continue to preview`

Secondary CTA:

- `Customize manually`

## Reveal Screen Copy

This is the reward moment. The copy should help the merchant feel proud, not merely informed.

## Reveal headline

- `Your store is ready to preview`

Alternative:

- `Here’s the first version of your store`

## Reveal supporting copy

- `We used your answers to create a polished starting point. Now you can explore it, customize it, and get it ready to launch.`

## Short summary block

Recommended:

- `We created`
  - `A storefront look and layout`
  - `Draft copy for your homepage and about page`
  - `A first product`
  - `Starter email and support content`

This helps the merchant understand that meaningful work happened.

## Reveal primary CTA

- `Customize in Studio`

## Reveal secondary CTAs

- `Add more products`
- `Connect Stripe`
- `Review launch checklist`

## Reveal helper copy for Stripe

- `Connect payments before you go live. You don’t need to do it before previewing your store.`

## Reveal helper copy for launch readiness

- `Your preview is ready now. Launch readiness comes next.`

## Workspace Handoff Copy

Once the merchant begins moving into the existing workspace, the copy should continue the same tone.

## Studio handoff

Instead of:

- `Open storefront studio`

prefer:

- `Customize your storefront`

## Catalog handoff

Instead of:

- `Open catalog`

prefer:

- `Add more products`

## Payments handoff

Instead of:

- `Integrations`

prefer:

- `Connect payments`

## Launch handoff

Instead of:

- `Finish setup`

prefer:

- `Get ready to launch`

## Existing Store Resume Copy

For users returning to onboarding, the tone should be supportive, not scolding.

## Resume headline

- `Pick up where you left off`

## Store card subcopy

Instead of:

- `3/5 complete`

prefer:

- `Your preview is started. Next up: add your first product.`

or:

- `You’re close. Next up: connect payments before launch.`

The numeric summary can still exist, but the main copy should be directional.

## Post-Reveal / Post-Onboarding Checklist Tone

The launch readiness surfaces should feel like a new phase, not like the app changed personalities.

Recommended framing:

- `Preview ready`
- `Add products`
- `Connect payments`
- `Review fulfillment`
- `Go live`

This is stronger than the older utility labels:

- `Profile`
- `Branding`
- `First product`
- `Payments`
- `Launch`

The internal system can still track those original states, but user-facing copy should reflect the merchant’s journey more clearly.

## Design Summary

The ideal onboarding copy system should:

- sound creation-first, not admin-first
- reduce pressure at every step
- reassure the user that imperfect input is acceptable
- make the generation phase feel meaningful
- make the reveal feel like a reward
- keep the post-reveal handoff clear and motivating

If the structure from `myrivo-151` is the skeleton, this bead defines the tone and pacing that make the experience feel premium instead of procedural.

