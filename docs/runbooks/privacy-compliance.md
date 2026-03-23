# Privacy Compliance Runbook

## Scope

This runbook covers the store-level privacy compliance layer that sits on top of store legal documents.

It includes:

- point-of-collection notices
- California privacy rights messaging
- do-not-sell/share link handling
- browser privacy signal handling, including Global Privacy Control
- shopper privacy request intake
- operator review/status handling in `Store Settings > Privacy`

## Merchant-facing surfaces

- `Store Settings > Privacy`
  - store privacy contacts and addenda
  - privacy request review panel
- `Admin > Legal`
  - platform storefront privacy governance
  - Privacy Policy / Terms publishing
- Storefront collection points
  - checkout
  - newsletter signup
  - review submission
- Storefront legal pages
  - `/privacy`
  - `/terms`
  - `/privacy/request`
- Storefront rights entry points
  - do-not-sell/share links and California rights sections
- Platform behavior
  - browser privacy signal handling and analytics suppression when required

## Configuration model

`platform_storefront_privacy_settings` stores the platform-governed storefront privacy behavior.

Important fields:

- `notice_at_collection_enabled`
- `checkout_notice_enabled`
- `newsletter_notice_enabled`
- `review_notice_enabled`
- `show_california_notice`
- `show_do_not_sell_link`

`store_privacy_profiles` stores the store-specific privacy configuration for each store.

Important fields:

- `privacy_contact_email`
- `privacy_rights_email`
- `privacy_contact_name`
- `collection_notice_addendum_markdown`
- `california_notice_markdown`
- `do_not_sell_markdown`
- `request_page_intro_markdown`

`store_privacy_requests` stores shopper-submitted privacy requests and workflow status.

`store_privacy_opt_outs` stores explicit do-not-sell/share states for shoppers who submitted an opt-out request.

## Information architecture rules

- Cookie preferences are not the same thing as privacy-rights intake.
- Browser privacy signals are honored automatically by the platform when supported.
- Do-not-sell/share should route shoppers into the privacy request flow with the request type preselected.
- Store-specific policy copy belongs on store legal pages and notices, not in the cookie banner.

## Operational guidance

### When a merchant asks why notices are not showing

Check:

1. `platform_storefront_privacy_settings.notice_at_collection_enabled`
2. the surface-specific platform toggle (`checkout_notice_enabled`, `newsletter_notice_enabled`, or `review_notice_enabled`)
3. that the storefront page is resolving the expected store slug

### When a merchant asks why California links are not showing

Check:

1. `platform_storefront_privacy_settings.show_california_notice`
2. `platform_storefront_privacy_settings.show_do_not_sell_link` for the opt-out link specifically
3. that the shopper is viewing the store-scoped storefront, not the platform-only privacy page

### When a merchant asks how Global Privacy Control works

Answer:

1. Myrivo detects and honors supported browser privacy signals at the platform layer
2. merchants do not configure GPC behavior per store
3. stores still own their policy copy, contact details, and manual response handling for incoming rights requests

### When a shopper submits a privacy request

Current workflow:

1. request is stored in `store_privacy_requests`
2. opt-out requests also create or refresh a `store_privacy_opt_outs` record
3. owner/admin can review both the request and any current opt-out state in `Store Settings > Privacy`
4. owner/admin updates request status manually (`open`, `in_progress`, `completed`, `closed`)

This is an operator handoff flow, not full automated rights fulfillment.

### When support sees a browser-signal privacy record

Interpretation:

1. `Browser signal` on an opt-out state means the shopper’s device sent a privacy signal when they submitted the request
2. request rows with `Browser signal detected` mean the intake request captured the same context for operator review
3. support should treat that as stronger context for the shopper’s intent, not as a separate duplicate request

### When a merchant asks how do-not-sell/share is tracked

Answer:

1. the storefront link routes into the privacy request form with opt-out preselected
2. submitting that request creates a durable opt-out state for the shopper email
3. owner/admin can revoke or reactivate that state from `Store Settings > Privacy`

## Support boundaries

Platform-owned:

- account-signup legal acceptance
- platform privacy statement
- browser-signal handling, including GPC
- shared request-routing and future suppression automation
- storefront privacy notice behavior and rights-entry visibility

Store-owned:

- store privacy contact details
- California addenda
- store-specific request intro and notice addenda
- response handling for store-level privacy requests

## Known limitations

- privacy requests do not yet trigger outbound notifications automatically
- there is not yet a dedicated support/admin inbox outside Store Settings > Privacy
- do-not-sell/share now has explicit state tracking, but it is not yet a full downstream suppression engine
- browser-signal honoring is platform-managed, but downstream fulfillment and operator review still depend on the broader privacy workflow
