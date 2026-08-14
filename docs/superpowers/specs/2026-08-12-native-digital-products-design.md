# Native Digital Products Design

## Summary

Myrivo will support first-class digital-download products alongside existing physical products. Merchants can attach multiple private files to a product or variant, show a public watermarked preview, sell digital and physical products in the same cart, and automatically grant secure download access after confirmed payment.

The MVP extends Myrivo's existing Catalog, storefront, checkout, order, refund, Email Studio, and Storefront Studio patterns. It does not introduce a separate digital-product application or merchant-configurable delivery policies.

## Goals

- Let a merchant sell artwork and similar downloadable products with multiple files.
- Preserve the low-friction existing product workflow.
- Keep original deliverables private and expose only watermarked previews publicly.
- Support digital-only, physical-only, and mixed carts.
- Deliver files automatically after confirmed payment without requiring a customer account.
- Give customers durable access and merchants clear delivery, access, and refund visibility.
- Preserve the exact assets and license terms purchased for auditability.

## Non-goals

- Streaming media, courses, or memberships
- Recurring digital subscriptions
- License keys or software-update delivery
- Commercial or extended-license tiers
- Free-form merchant licenses
- Merchant-configurable token expiry or download limits
- Product variants that mix physical and digital fulfillment within one product
- Digital commissions or delayed/manual deliverables

## Product Policies

### Delivery policy

- Digital access-page links expire after 48 hours.
- A buyer may request a fresh link after verifying the checkout email.
- Each purchased file permits five successful download grants over the lifetime of the entitlement.
- Regenerating an access link does not reset download grants.
- A short grace window reuses a recently issued grant so refreshes or accidental double-clicks do not consume multiple grants.

### Refund policy

Digital purchases are final after any included file is downloaded, except for defective, inaccessible, materially misrepresented, duplicate, fraudulent, or otherwise legally required refunds. Merchants may override the policy through the existing refund workflow.

- A successful full refund revokes remaining access.
- A requested, processing, failed, or cancelled refund does not revoke access.
- A partial monetary refund preserves access in the MVP.
- An open dispute suspends downloads; a lost dispute permanently revokes them.
- The merchant sees whether access occurred before deciding on a refund.

### License policy

The MVP uses one versioned platform-wide personal-use license:

- The buyer may download and print a reasonable number of copies for personal use or personal gifts.
- The buyer may not resell, redistribute, share, sublicense, upload, or commercially exploit the files or artwork.
- Copyright remains with the creator.
- Purchase grants a non-exclusive, non-transferable license rather than ownership.

Merchants must affirm that they own or control the rights necessary to distribute uploaded files. The accepted license version is snapshotted on purchase. Final license, consent, refund, privacy, and cross-border tax language requires legal review before launch. Legal review of the license, consent, refund, and privacy language was approved by Michael Baldwin (mbaldwin@vso-inc.com) on 2026-08-14.

## Existing UX Fit

The design is based on the current Myrivo surfaces:

- Catalog uses a product table, persistent inspector, and create/edit flyout.
- The flyout already has Product, Variant, and Option steps.
- Product detail uses an image carousel, variant controls, and purchase card.
- Cart and pre-Stripe checkout share one page.
- The Stripe return page currently communicates finalization state.
- Customer and merchant order details are organized around summary, items, fulfillment, activity, and refunds.

Digital behavior conditionally extends these surfaces instead of creating a separate visual language.

## Merchant Catalog Experience

### Catalog table and inspector

Add an explicit product type: `physical` or `digital`. One product cannot contain both types of variants in the MVP.

The catalog table replaces the physical-only Inventory column with a Fulfillment column that displays Physical or Digital. Inventory remains available through the inspector for physical products.

The inspector adapts by type:

- Physical: Overview, Variants, Inventory, Media
- Digital: Overview, Variants, Files, Media

The digital Overview shows product type, price range, applicable file count, and preview-processing status.

### Create and edit flyout

Product type is chosen at the start of the existing Product step. Existing title, rich description, slug, SEO, storefront media, alt text, featured status, and Variant/Option flows remain.

For digital products, hide inventory quantity, made-to-order, and shipping-specific controls. Show a summary of customer files, preview readiness, the standard delivery/license policy, and the required rights affirmation.

Files are attached from the inspector after the draft product exists. This avoids orphaned uploads and allows variant-specific assignment against durable IDs.

### Files tab

The Files tab supports multiple uploads and displays:

- Customer-facing filename and label
- File type and size
- Product-wide or variant-specific applicability
- Upload/processing state: Uploading, Processing, Ready, Failed
- Retry, replace, reorder, and remove actions
- Existing-purchase dependency warnings before destructive removal

The Media tab continues to manage public storefront images. An automatically generated watermarked preview may be replaced with a merchant-provided public preview.

### Publishing requirements

A digital product cannot become active until:

- At least one deliverable is ready.
- Every active variant has at least one applicable ready file.
- A public watermarked preview is ready.
- The merchant has affirmed distribution rights.

Failed processing does not prevent continued editing, but publishing remains unavailable if the requirements are unmet.

## Buyer Experience

### Product detail

Reuse the existing image/content/purchase-card hierarchy. A digital product displays:

- A Digital download badge
- Watermarked public images only
- Included file count and basic format information
- Immediate-after-payment delivery wording
- Personal-use license summary

Digital quantity is fixed at one. Existing variant controls select different file bundles when applicable. Inventory and made-to-order copy are replaced with digital availability copy.

### Cart and checkout

Cart behavior derives from its contents:

**Physical-only:** existing behavior remains unchanged.

**Digital-only:** collect first name, last name, and email. Omit phone, shipping/pickup selection, shipping fees, pickup details, and quantity controls.

**Mixed:** retain name, phone, email, and physical fulfillment controls. Shipping and free-shipping promotions apply only to the physical portion. Digital items display that they will be delivered after payment.

Any cart containing digital goods requires one explicit acknowledgment near the checkout button covering immediate delivery, the personal-use license, and the digital refund policy. Record the wording/version and acceptance time with the checkout.

### Post-payment

After order finalization, the existing Stripe-return page becomes the first access surface. Digital orders show a prominent View downloads action and explain that a 48-hour access link was also emailed. Mixed orders show both digital access and the physical-order next step.

The page must not claim downloads are ready until entitlement creation succeeds. During webhook/finalization delay it retains the existing preparing state.

## Customer Access

The customer order page adds a Downloads section above physical fulfillment content. It lists each purchased file, remaining grants, entitlement status, and a Download action. Mixed orders retain their existing shipping, pickup, tracking, totals, and delay sections below it.

Signed-in customers may use their authenticated order history. Guest customers use the 48-hour emailed access link. A guest may request a fresh link by entering the purchase email; the endpoint always returns a neutral response to prevent order discovery.

The protected access page is stable. It does not embed direct long-lived storage URLs.

## Merchant Orders and Refunds

### Order list

Digital delivery is separate from physical fulfillment:

- Digital-only paid order: `Files delivered`
- Mixed paid order: existing physical fulfillment status plus a secondary `Files delivered` indicator
- Physical-only order: unchanged

Digital-only orders must never display Pending fulfillment or Not shipped.

### Order detail

Add a Digital delivery section showing:

- Delivery readiness and email status
- Files and purchased versions
- Total grants used and remaining
- First and latest access timestamps
- Revoked or suspended state
- Send fresh access link action

Resending access does not reset grants. The existing activity timeline records entitlement creation, delivery attempts, regenerated access, grants, suspension, and revocation.

### Refund dialog

Extend the existing refund dialog with digital context. If any file was accessed, show a clear warning and the accepted final-after-first-download policy while still allowing merchant override.

A successful full refund revokes all digital entitlements for the order. A partial monetary refund preserves access. Mixed-order item-level revocation is deferred until the refund system supports item-level refunds; the UI must state the effect before confirmation.

## Data Model

### Product type

Add `products.product_type` with validated values `physical` and `digital`, defaulting existing rows to `physical`.

### Digital assets

Create a digital asset/version model containing:

- Store, product, and optional variant IDs
- Stable logical asset ID and immutable version ID
- Private storage object path
- Customer-facing filename and label
- MIME type, byte size, and checksum
- Sort order and active state
- Processing status and failure reason
- Created and retired timestamps

Product-wide files apply to every variant. Variant-specific files apply only to that variant. Updating a deliverable creates a new version rather than overwriting the prior object.

### Preview metadata

Track the selected preview source, generated public preview path, watermark-processing state, and optional merchant override. Public preview metadata must never reference the private original path.

### Entitlements

When payment succeeds, create immutable entitlement rows for every applicable asset version purchased. Each row snapshots:

- Order and order-item IDs
- Product and variant snapshot identifiers
- Asset and version IDs
- Customer-facing filename and file metadata
- License version
- Maximum grants (`5`)
- Grants used
- Active, suspended, or revoked status and reason
- First/latest access timestamps

Deleting or changing a product does not remove assets referenced by paid entitlements.

### Access and audit records

Store hashed order-access tokens with expiry, issuance reason, and revocation state. Never store raw tokens.

Record each grant reservation and relevant outcome with entitlement, timestamp, and minimal operational metadata. Do not store raw access tokens or unnecessary customer data. Retention must follow the platform privacy policy.

### Configuration

Centralize and validate:

- Access-link lifetime: 48 hours
- Grants per purchased file: 5
- Grant-reuse grace window
- Private storage URL lifetime
- Allowed MIME types/extensions
- Maximum files per product: 20
- Maximum file size: 250 MB
- Watermark text/style and preview dimensions
- Rate limits for link requests and downloads
- Digital-goods Stripe Tax classification

## Storage and Preview Processing

Original deliverables use a private Supabase Storage bucket. Uploads use short-lived signed upload authorization so large bodies do not pass through a Vercel Function.

For JPG and PNG deliverables, Myrivo may generate a reduced-resolution watermarked preview from a selected source. PDF- or ZIP-only products require a separate storefront image, which Myrivo watermarks. The default watermark tiles the store name across the image. A merchant preview override is validated as public storefront media and is not watermarked again.

Preview processing is asynchronous and idempotent. Originals never become public, and private paths never enter storefront responses, analytics, or email content.

## Checkout and Entitlement Finalization

Before creating a Stripe Checkout Session, Myrivo captures an immutable purchase manifest containing the exact applicable asset versions and accepted consent/license versions. Stripe metadata carries only the opaque manifest ID; later catalog edits cannot change what the buyer purchased.

Stripe payment confirmation remains the source of truth. The idempotent checkout-finalization path must:

1. Finalize the paid order.
2. Persist the exact digital-consent and license version.
3. Resolve and snapshot applicable asset versions.
4. Create entitlements with five grants per file.
5. Mark digital delivery ready.
6. Enqueue or attempt the customer delivery email.

Retries must not duplicate entitlements, grant counts, or notification audit entries. Physical inventory changes only for physical order items. Digital items have no inventory constraint. Finalization creates a durable delivery job before returning success; email or entitlement-processing failures remain retryable after the request or webhook ends.

## Download Authorization

The 48-hour access link identifies an order through a random token stored only as a hash. It is not a storage URL.

For every Download action, the server must atomically:

1. Authenticate the signed-in customer or validate the guest access token.
2. Confirm the order is paid.
3. Confirm the entitlement is active and not suspended/revoked.
4. Confirm a grant remains or a valid grace-window reservation exists.
5. Reserve one grant under concurrency control.
6. Issue a private Supabase signed URL lasting only a few minutes.
7. Record the event without logging the token or signed URL.

Concurrent requests must not exceed five grants. A page refresh does not consume a grant; only requesting a file URL does.

A storage-signing failure does not consume a grant. The reservation must be released safely unless a private signed URL was issued successfully.

## Email and Studio Integration

The existing customer order-confirmation pipeline gains digital-delivery content. The email includes a View downloads button targeting the Myrivo access page. It never includes direct storage links.

Email Studio gains digital-only and mixed-order preview states and safe fields for delivery copy. Storefront Studio gains digital-only and mixed cart/order-summary preview states. Token values and raw download URLs are not editable template variables.

Email failure does not remove the entitlement. It records a failed attempt, remains retryable, and exposes the merchant resend action.

## Tax and Legal

Digital products use the store's existing tax mode. Stripe Tax must receive the centrally configured digital-goods classification and enough billing-location information for the applicable jurisdiction. The exact tax behavior and seller/platform obligations require review before broad geographic launch.

EU/UK-style immediate-delivery consent must be explicit where applicable, including acknowledgment that beginning digital delivery may waive a statutory withdrawal right. Consent evidence is stored with the order.

## Error Handling and Operations

- Upload failure: retain the draft asset with a safe failure reason and retry action.
- Preview failure: keep the product editable but prevent publishing when no valid preview exists.
- Webhook retry: idempotently complete only missing finalization steps.
- Email failure: retain access and provide merchant resend.
- Asset replacement: create a new version; preserve purchased versions.
- Product deletion: retain purchased versions and entitlements.
- Full successful refund: revoke access and record an audit event.
- Open dispute: suspend access; restore on a won/resolved dispute or revoke on loss.
- Abuse: rate-limit token requests and grants and surface anomalous activity in operational logs.
- Storage failure during download: do not consume a grant unless URL issuance succeeds, or release the reservation safely.

## Testing and Validation

### Unit and integration tests

- Product-type validation and physical default backfill
- Product-wide and variant-specific asset resolution
- Publishing readiness rules
- File type, size, and count validation
- Watermark job idempotency and public/private separation
- Digital-only checkout field requirements
- Mixed-cart totals, fulfillment, promotions, and physical inventory
- License/consent snapshot persistence
- Duplicate webhook/finalization handling
- Entitlement version retention after product changes/deletion
- Email failure and resend without grant reset
- Guest verification neutral response, expiry, hashing, and rate limits
- Atomic five-grant enforcement under concurrency
- Grace-window behavior
- Full refund, partial refund, dispute suspension, restoration, and revocation
- Signed-in ownership checks

### UI and accessibility tests

- Catalog table, inspector, Files tab, and conditional flyout fields
- Product detail digital labeling and fixed quantity
- Physical-only regression coverage
- Digital-only and mixed cart layouts
- Required consent and accessible error placement
- Stripe-return ready and preparing states
- Customer download and merchant delivery sections
- Refund warning and revocation disclosure
- Keyboard, screen-reader, loading, empty, failed, and responsive states
- Storefront Studio and Email Studio preview states

### End-to-end validation

Run a production-like Stripe test-mode purchase for:

1. A physical-only cart to prove no regression.
2. A digital-only cart through email/access/download.
3. A mixed cart through digital access and physical fulfillment.
4. Guest link expiry and regeneration.
5. Refund and dispute access changes.

All required repository gates must pass: lint, typecheck, tests, and build.

## Rollout

Gate the capability behind a configurable, store-scoped feature flag that defaults off. Launch with internal/test stores, validate real Stripe test-mode delivery and refund behavior, then enable selected merchants store by store. Monitor upload failures, entitlement-finalization failures, email delivery, regenerated-link rates, download errors, refund rates, and disputes before general availability.

Update the user-facing legal documents, help content, operations runbooks, environment documentation, and `[Unreleased]` changelog before launch.
