# Welcome Popup Campaign Operations

## Purpose

Support and growth teams use this runbook to troubleshoot the storefront welcome popup that captures email subscribers and delivers a welcome discount code by email.

## Preconditions

Before escalating a storefront issue, confirm:

- newsletter capture is enabled for the store
- the welcome popup campaign is enabled in Storefront Studio
- a promotion is selected
- the selected promotion is active and still redeemable
- Resend and platform email configuration are healthy

## Common Failure Modes

### Popup does not appear

Check:

- the shopper is on a public storefront page, not cart or checkout
- the campaign is enabled
- the selected promotion is active
- the same browser has not already subscribed or dismissed the popup recently

### Signup succeeds but no discount email arrives

Check:

- the subscriber record exists in `store_email_subscribers`
- the record metadata includes `welcome_popup_promotion_id`
- Resend delivery is healthy
- the store has a monitored support email and mailing address so marketing compliance defaults are complete

### Merchant says the wrong code was sent

Check:

- the currently selected promotion in Storefront Studio
- whether the shopper subscribed under an older campaign configuration
- promotion validity windows and redemption limits

## Support Notes

- Welcome-popup signups use the normal marketing subscriber list and should not create a second consent source.
- The popup is intentionally theme-derived. Do not offer per-campaign custom modal styling outside the existing Studio controls unless the product contract changes.
