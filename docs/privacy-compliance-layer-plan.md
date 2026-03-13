# Privacy Compliance Layer

## Goal

Add a real privacy compliance layer for shopper data collection without turning privacy into a second storefront builder. The product should make clear which disclosures Myrivo owns at the platform layer and which details each merchant needs to review or customize.

## Ownership Split

### Platform-owned

- Platform-wide accessibility, privacy, and support posture pages
- Account-signup legal acceptance and platform account/privacy disclosure
- Future automation for privacy rights fulfillment
- Browser- or platform-level privacy signals, including future Global Privacy Control support

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

## Non-goals

- A separate California legal page for every store by default
- A drag-and-drop privacy builder
- Moving shipping/returns/editorial policy content out of Storefront Studio
- Store-managed account signup or platform legal acceptance behavior
