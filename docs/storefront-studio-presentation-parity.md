# Storefront Studio Presentation Parity

This document records which storefront presentation controls are owned by Storefront Studio, which are intentionally edited inline in the preview, and which remain outside Studio by design.

## Inline In Preview

- Header logo
- Header store title
- Home hero eyebrow
- Home hero headline
- Home hero subcopy
- Home hero badges
- Home hero image
- Home hero CTA labels and URLs
- Home content block copy
- Home content block CTA labels and URLs
- Home content block add, reorder, remove, and visibility
- Products heading
- Products filter panel title
- Products no-results copy
- Reviews section title
- Reviews empty-state copy
- Reviews load-more label
- Reviews form title
- About copy fields
- About section add, reorder, remove, layout, and image controls
- Policies copy fields
- Policies FAQ add, reorder, remove, visibility, question, and answer
- Cart copy
- Footer tagline
- Footer note
- Footer newsletter heading
- Footer newsletter description

## Controlled From Studio Rail

### Branding

- Hero layout
- Primary color
- Primary foreground color
- Accent color
- Accent foreground color
- Background color
- Surface color
- Text color
- Page width
- Font family
- Corner radius
- Card style
- Page spacing
- Primary CTA style

### Header

- Announcement bar visibility
- Header logo visibility
- Header logo size
- Header title visibility
- Header title size
- Header background color
- Header foreground color
- Header navigation item visibility

### Footer

- Footer navigation item visibility
- Footer back-to-top visibility
- Footer owner-login visibility
- Newsletter module visibility
- Newsletter success message
- Instagram URL
- Facebook URL
- TikTok URL

### Pages

- Home section-level visibility and sizing
- Products layout, filter, card, and reviews configuration
- Products search placeholder
- Reviews summary template
- Reviews submit/submitting labels
- Reviews moderation success message
- About article and remaining page-level copy not naturally shown inline at all times
- Policies fallback FAQ copy
- Order summary copy

## Intentionally Outside Studio

- SEO metadata
- Favicon and browser/social preview assets
- Domains
- Team
- Integrations
- Shipping operational settings
- Pickup operational settings
- Publish/review workflow
- Transactional email templates

## Known Intentional Exclusion

- `buttonStyle` exists in theme config but is not currently consumed by storefront renderers, so it is intentionally not exposed in Studio until it becomes a real visual control.
