# Privacy Compliance Layer

## Goal

Add a real privacy compliance layer for shopper data collection without turning privacy into a second storefront builder. The product should make clear which disclosures Myrivo owns at the platform layer and which details each merchant needs to review or customize.

## Ownership Split

### Platform-owned

- Platform-wide accessibility, privacy, and support posture pages
- Account-signup legal acceptance and platform account/privacy disclosure
- Browser- or platform-level privacy signals, including Global Privacy Control detection and enforcement
- Shared suppression plumbing, request-routing infrastructure, and future automation for privacy rights fulfillment

### Store-owned

- Store Privacy Policy document and store-specific privacy addenda
- Store privacy contact details and rights contact information
- Whether California-specific rights disclosures are shown for the storefront
- Whether a do-not-sell/share link is shown
- Operational handling of privacy requests submitted against the store

## UX Direction

- Keep formal legal documents in `Store Settings > Legal`
- Extend that same Legal surface with a structured privacy compliance section
- Avoid a standalone “Legal Studio” or “Privacy Studio”
- Use strong defaults plus a few merchant-editable fields instead of freeform configuration everywhere

## Shopper Journey Surfaces

### Point-of-collection notices

These should appear anywhere store-level personal information is collected:

- Checkout
- Newsletter signup
- Review submission

### Formal documents

- `/privacy`
- `/terms`

### Privacy rights actions

- Privacy page section for California rights, when enabled
- Dedicated privacy request page for consumer/privacy requests
- Do-not-sell/share link routed into the privacy request workflow when enabled
- Browser privacy signals honored automatically by the platform without requiring shopper action in the cookie banner

## Terminology and IA

- `Cookie preferences` controls optional analytics and storage categories managed by the platform.
- `Privacy request` covers access, deletion, correction, know, and do-not-sell/share intake at the store level.
- `Global Privacy Control` is treated as a browser signal, not a merchant-configurable toggle.
- `Do not sell or share my information` should be presented as a rights action entry point, not buried inside generic contact copy.

## Operator UX Direction

- Keep configuration in `Store Settings > Legal`, not a new privacy workspace.
- Put incoming privacy requests in the existing Legal review panel until a broader support inbox exists.
- Surface do-not-sell/share enablement near California notice controls so merchants understand they are part of the same rights model.
- Keep browser-signal behavior platform-owned and documented rather than merchant-customizable.

## Non-goals

- A separate California legal page for every store by default
- A drag-and-drop privacy builder
- Moving shipping/returns/editorial policy content out of Storefront Studio
- Store-managed account signup or platform legal acceptance behavior
