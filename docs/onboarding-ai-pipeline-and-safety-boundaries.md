# Onboarding AI Pipeline And Safety Boundaries

## Purpose

This document defines the onboarding AI pipeline, safety boundaries, and provider/model abstraction strategy for the ideal Myrivo onboarding experience.

This is the design output for `myrivo-154`.

It builds on:

- `docs/onboarding-data-model-and-generation-contracts.md`
- `docs/onboarding-ai-surface-inventory.md`
- `docs/onboarding-ux-ia-design.md`
- `docs/onboarding-copy-and-pacing-design.md`

## Non-Negotiable Requirement

The onboarding AI system must be provider-agnostic.

That means:

- no core onboarding logic should depend on OpenAI-specific request or response shapes
- no persistence layer should store provider-specific output as the canonical contract
- no UI flow should assume a particular model vendor

OpenAI can be the first implementation, but it must be an adapter, not the architectural center.

## Core Design Goal

The AI layer should do four things well:

1. accept a stable internal generation input contract
2. return a stable internal generation output contract
3. allow providers/models to be swapped without changing onboarding UX or persistence
4. fail safely without breaking the merchant’s store creation flow

## Architectural Layers

## Layer 1: Onboarding orchestration

This layer belongs to the app and is provider-neutral.

It is responsible for:

- deciding when generation should run
- normalizing onboarding answers into the generation input contract
- persisting generation runs and statuses
- validating structured generation output
- applying the validated output into real store surfaces
- handling retries, failure states, and fallback behavior

This layer should not know anything about:

- provider-specific request payloads
- provider-specific tool syntax
- provider-specific structured output enforcement semantics

## Layer 2: Generation service interface

This is the stable internal boundary.

Recommended interface shape:

```ts
type OnboardingGenerationProvider = {
  providerId: string;
  generate(input: OnboardingGenerationInput): Promise<OnboardingGenerationResult>;
};
```

Where:

- `OnboardingGenerationInput` is the canonical internal input schema
- `OnboardingGenerationResult` is the canonical internal output schema plus metadata

This is the seam that allows swapping providers later.

## Layer 3: Provider adapters

Each AI provider gets its own adapter that:

- turns internal input into provider-specific prompt/request format
- handles provider-specific auth, API, and schema enforcement
- turns provider-specific output back into the canonical internal result

Examples:

- `OpenAIOnboardingGenerationProvider`
- `AnthropicOnboardingGenerationProvider`
- `GoogleOnboardingGenerationProvider`
- `LocalOnboardingGenerationProvider`

The rest of onboarding should not care which one is active.

## Stable Internal Contracts

These should be provider-independent and versioned by Myrivo, not by any AI vendor.

## 1. `OnboardingGenerationInput`

This should match the contract defined in:

- `docs/onboarding-data-model-and-generation-contracts.md`

It should be:

- normalized
- deterministic
- provider-neutral
- serializable into generation run snapshots

## 2. `OnboardingGenerationOutput`

This must be:

- fully structured
- provider-neutral
- mappable to the existing store system
- validated before application

The provider should not return canonical freeform markdown blobs as the primary contract.

## 3. `OnboardingGenerationRunMetadata`

This should store:

- provider ID
- model ID
- request version
- timing
- token/cost metadata if available
- raw provider diagnostics where useful

Important:

- metadata can be provider-specific
- the actual applied content contract should not be

## Recommended Service Selection Strategy

## Configuration layer

The selected provider and model should come from configuration, not hardcoded logic.

Recommended configuration concept:

- `ONBOARDING_AI_PROVIDER`
- `ONBOARDING_AI_MODEL`
- optional provider-specific credentials

The orchestration layer should resolve:

- which adapter to use
- which model to ask for

without any code changes in the onboarding flow itself.

## Provider registry

Recommended pattern:

```ts
const onboardingGenerationProviders = {
  openai: createOpenAIOnboardingProvider(...),
  anthropic: createAnthropicOnboardingProvider(...),
  google: createGoogleOnboardingProvider(...),
};
```

Then:

```ts
const provider = onboardingGenerationProviders[configuredProvider];
```

This keeps the swap boundary obvious.

## Prompt Assembly Strategy

Prompting should also be layered.

## Provider-neutral prompt inputs

The orchestration layer should assemble a provider-neutral prompt context object that includes:

- store identity
- merchant description
- visual direction
- first product context
- generation scope
- explicit content boundaries
- output contract requirements

This context object is the same no matter which provider is active.

## Provider-specific prompt rendering

Each adapter should render that context into provider-specific prompt format.

That means:

- one provider might use a “system” + “user” pattern
- another might use different instruction fields
- another might prefer schema-first structured generation

That is the adapter’s concern, not onboarding’s concern.

## Recommended prompt modules

The adapter should conceptually build prompts from reusable pieces:

- role / system instruction
- task instruction
- safety boundary instruction
- schema/output instruction
- brand/style input context
- product input context

This makes it easier to swap providers without rewriting the business intent.

## Structured Output Enforcement

The system should assume that providers differ in how strongly they enforce structured output.

So the architecture should not rely solely on provider-native schema enforcement.

Recommended rule:

- always perform server-side validation against Myrivo’s canonical output schema after the provider returns

That means:

- provider-native structured output is helpful
- provider-native structured output is not the trust boundary

## Validation Pipeline

Recommended validation sequence:

1. provider returns result
2. adapter converts provider output to candidate internal output
3. server validates candidate against the canonical schema
4. invalid sections are rejected or dropped
5. only validated output is eligible for apply

This is important for portability and safety.

## Partial Success Model

The pipeline should support partial success because not every provider will always produce perfect output in every section.

Recommended section-level validation model:

- branding
- storeSettings
- storeExperienceContent
- emailStudio
- firstProductEnrichment

Each section can be:

- valid
- invalid
- missing

That allows:

- partial apply
- deterministic fallbacks
- better resilience across providers and model quality levels

## Safety Boundaries

## Hard content boundary

The generation pipeline must not generate:

- governed Privacy Policy bodies
- governed Terms & Conditions bodies
- platform legal documents
- storefront legal base templates

This boundary should be enforced in two places:

- prompt instructions
- output schema

The best safeguard is that those fields do not exist in the output contract at all.

## Operational truth boundary

The AI layer should not invent:

- connected payment status
- domain verification status
- pickup locations
- actual shipping promises that exceed configured operations
- tax/compliance readiness

It can draft merchant-facing copy, but it must not fabricate operational state.

## Product truth boundary

The AI layer may enrich a product, but it should not silently change merchant-provided core facts like:

- declared price
- declared option values
- declared stock mode

It can:

- improve the description
- improve SEO phrasing
- create alt text
- improve presentation copy

It should not:

- reinterpret the product into something materially different

## Brand safety boundary

The AI layer should use the merchant’s inputs and brand direction, but avoid:

- regulated claims
- health claims that go beyond the merchant’s own wording
- misleading promises
- fabricated certifications or ingredients

This matters especially for stores like wellness, apothecary, cosmetics, food, or supplements.

## Provider-Agnostic Failure Handling

Failure handling should also be provider-neutral.

The orchestration layer should categorize failures into app-level reasons like:

- `provider_unavailable`
- `authentication_failed`
- `rate_limited`
- `invalid_output`
- `timeout`
- `apply_failed`

These app-level reasons should be stored in generation runs and used for UX.

Provider-specific raw errors can still be logged in metadata, but the workflow should not expose provider-specific failure semantics to the UI.

## Retry Strategy

Recommended retry logic:

- no infinite automatic retries
- one immediate retry for clearly transient failures
  - timeout
  - provider unavailable
  - rate-limited with retryable indication
- no blind retry for invalid structured output unless a fallback model/provider path is configured

This keeps cost under control and avoids runaway loops.

## Fallback Strategy

The pipeline should support three levels of fallback:

## Level 1: Same-provider fallback

If the primary model fails transiently:

- retry once with the same provider/model

## Level 2: Alternate provider/model fallback

If configured, the orchestration layer may fall back to:

- another model under the same provider
- or another provider entirely

This is why the provider-neutral contract matters.

## Level 3: Deterministic non-AI fallback

If no generation succeeds:

- apply deterministic defaults
- preserve the real store and first product
- let the merchant continue to preview and customize

This is the ultimate safety net.

## Cost Controls

Provider-neutral cost control policies should live above any specific adapter.

Recommended controls:

- one primary generation run per onboarding completion
- no generation on every field keystroke
- regenerate only by explicit user or admin action
- keep input contract compact and normalized
- avoid sending large unnecessary blobs

Recommended metadata to track when available:

- input token estimate
- output token estimate
- cost estimate
- provider/model used

This lets us compare providers later without changing the UX contract.

## Apply Strategy

The apply step should be entirely provider-agnostic.

Recommended flow:

1. select provider adapter
2. generate provider output
3. normalize to canonical output
4. validate canonical output
5. compute apply plan
6. apply section-by-section into runtime surfaces
7. persist applied snapshot and section results

The “apply plan” should be explicit so we can later support:

- preview-only dry runs
- selective regeneration
- admin debugging tools

## Recommended Internal Types

Recommended core app-level types:

- `OnboardingGenerationInput`
- `OnboardingGenerationOutput`
- `OnboardingGenerationSectionResult`
- `OnboardingGenerationResult`
- `OnboardingGenerationProvider`
- `OnboardingGenerationFailureReason`

This naming helps keep provider concerns out of the broader app.

## OpenAI As First Adapter, Not Core Assumption

If OpenAI is the first provider, that’s fine.

But the architecture should treat it as:

- an implementation of `OnboardingGenerationProvider`

not:

- the shape of the onboarding system itself

That means:

- no `openai_*` fields in canonical onboarding tables
- no prompt logic living inside generic onboarding orchestration
- no provider-specific output shape stored as the canonical output contract

The canonical contract belongs to Myrivo.

## Observability

The generation pipeline should expose app-level observability regardless of provider:

- generation success rate
- failure reason distribution
- average latency
- partial-apply frequency
- fallback usage
- completion-to-preview conversion

This will matter if you later compare providers or models.

## Recommended Final Architecture

The provider-agnostic onboarding AI stack should look like this:

```text
Onboarding answers
  -> normalized generation input
  -> provider-neutral orchestration service
  -> selected provider adapter
  -> canonical output validation
  -> apply plan
  -> existing store runtime surfaces
  -> reveal screen
```

## Final Recommendation

Build the onboarding AI pipeline so that:

- Myrivo owns the input contract
- Myrivo owns the output contract
- Myrivo owns validation and apply logic
- providers are swappable adapters
- OpenAI can be the first adapter
- deterministic fallback always exists

That gives you the flexibility to:

- switch models
- switch providers
- compare providers
- add failover
- or even use multiple providers later

without redesigning the onboarding experience or its persistence model.

