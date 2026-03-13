# Privacy Compliance Runbook

## Scope

This runbook covers the store-level privacy compliance layer that sits on top of store legal documents.

It includes:

- point-of-collection notices
- California privacy rights messaging
- do-not-sell/share link handling
- shopper privacy request intake
- operator review/status handling in `Store Settings > Legal`

## Merchant-facing surfaces

- `Store Settings > Legal`
  - privacy compliance settings
  - Privacy Policy / Terms publishing
  - privacy request review panel
- Storefront collection points
  - checkout
  - newsletter signup
  - review submission
- Storefront legal pages
  - `/privacy`
  - `/terms`
  - `/privacy/request`

## Configuration model

`store_privacy_profiles` stores the privacy-compliance configuration for each store.

Important fields:

- `notice_at_collection_enabled`
- `checkout_notice_enabled`
- `newsletter_notice_enabled`
- `review_notice_enabled`
- `show_california_notice`
- `show_do_not_sell_link`
- `privacy_contact_email`
- `privacy_rights_email`
- `privacy_contact_name`

`store_privacy_requests` stores shopper-submitted privacy requests and workflow status.

## Operational guidance

### When a merchant asks why notices are not showing

Check:

1. `store_privacy_profiles.notice_at_collection_enabled`
2. the surface-specific toggle (`checkout_notice_enabled`, `newsletter_notice_enabled`, or `review_notice_enabled`)
3. that the storefront page is resolving the expected store slug

### When a merchant asks why California links are not showing

Check:

1. `show_california_notice`
2. `show_do_not_sell_link` for the opt-out link specifically
3. that the shopper is viewing the store-scoped storefront, not the platform-only privacy page

### When a shopper submits a privacy request

Current workflow:

1. request is stored in `store_privacy_requests`
2. owner/admin can review it in `Store Settings > Legal`
3. owner/admin updates status manually (`open`, `in_progress`, `completed`, `closed`)

This is an operator handoff flow, not full automated rights fulfillment.

## Support boundaries

Platform-owned:

- account-signup legal acceptance
- platform privacy statement
- future automation/GPC support

Store-owned:

- store privacy contact details
- store privacy policy content
- California addenda
- response handling for store-level privacy requests

## Known limitations

- privacy requests do not yet trigger outbound notifications automatically
- there is not yet a dedicated support/admin inbox outside Store Settings > Legal
- do-not-sell/share is currently an intake path, not a full downstream suppression engine
