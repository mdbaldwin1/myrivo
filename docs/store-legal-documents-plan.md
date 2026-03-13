# Store Legal Documents Plan

## Goal

Add store-level `Privacy Policy` and `Terms & Conditions` support without turning legal content into another heavy visual studio.

## Product decision

We are **not** building a standalone Legal Studio right now.

The initial experience should be:

- `Storefront Studio` keeps owning customer-facing policy presentation
- `Store Settings > Legal` owns formal legal documents

This split keeps storefront editing intuitive while giving formal legal content a more stable, deliberate home.

## Ownership split

### Storefront Studio owns

- shipping and returns summaries
- support contact presentation
- FAQ content
- policy page headings and explanatory copy

These are customer-experience and merchandising-adjacent surfaces. Merchants should keep editing them in context on the storefront canvas.

### Store Settings > Legal owns

- Privacy Policy
- Terms & Conditions
- template variables and merchant addenda
- publish/effective-date state
- legal-document safeguards and auditability

These are formal documents, not marketing copy.

## Why not a Legal Studio?

Email Studio works because emails are:

- repeated
- highly branded
- layout-sensitive
- preview-driven

Legal documents are different:

- they are long-form and low-frequency
- correctness matters more than layout experimentation
- merchants need trust, defaults, and guardrails more than creative freedom

A dedicated legal editor is useful. A full visual studio is not the right starting point.

## UX direction

The legal editing experience should feel like:

- a clear `Legal` page in Store Settings
- two first-class document tabs or sections: `Privacy Policy` and `Terms & Conditions`
- strong starter templates
- merchant variables and addenda
- a readable storefront preview
- explicit publish/effective-date information

It should **not** feel like:

- another freeform CMS page builder
- another detached duplicate of the Policies page
- a blank markdown textarea with no structure or guardrails

## Runtime model

Storefronts should eventually render store-specific legal documents at:

- `/privacy`
- `/terms`

Those routes already exist for Myrivo platform legal pages. The store-level implementation should preserve the familiar URLs while resolving the content from the active storefront/store context.

## Relationship to the Policies page

The existing storefront `Policies` page remains valuable.

Its role should be:

- shipping and return expectations
- support contact
- helpful FAQs
- buyer guidance before purchase

It should also become the place where customers can navigate to the store's formal Privacy Policy and Terms documents.

## Non-goals for the first release

- no drag-and-drop legal layout builder
- no per-clause visual customization system
- no requirement that merchants write legal docs from scratch
- no attempt to replace platform-level Myrivo legal governance

## Bead sequencing rationale

1. define the ownership split first
2. build the data model and template-resolution layer
3. build the Store Settings legal editor
4. render public storefront legal pages
5. add template variables and previews
6. wire navigation and policy references
7. add publishing safeguards
8. finish tests and rollout docs
