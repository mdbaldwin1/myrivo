# Cookie Compliance Runbook

## Scope

This runbook covers the platform-managed cookie compliance layer for Myrivo public pages and storefronts.

The first rollout includes:

- a cookie inventory and category model
- a cookie policy page
- a shopper-facing cookie banner and preferences center
- consent-gated storefront analytics cookies and similar storage

## Ownership boundary

Platform-owned:

- cookie inventory and category definitions
- cookie policy content
- consent persistence and preferences UX
- analytics-cookie gating and enforcement

Store-owned:

- no store-level cookie categories in the first rollout
- no store-specific cookie banner customization in the first rollout

Rationale:

- the same platform code controls auth/session cookies, storefront analytics, and public UX
- allowing store-level cookie logic too early would create inconsistent compliance behavior

## Cookie categories

### Essential

Always enabled. These support core platform or storefront functionality and are not optional in the first rollout.

Current essential items:

- Supabase auth/session cookies
- active store selection cookie for the dashboard
- cookie preferences cookie

### Analytics

Optional. These support storefront traffic and conversion analytics and should not run until the shopper has granted analytics consent.

Current analytics items:

- `myrivo_analytics_sid`
- `myrivo.analytics.session.<store-slug>` local storage

## Public UX requirements

The public experience should provide:

1. a banner when no consent choice has been recorded
2. a way to accept essential-only cookies
3. a way to accept analytics cookies
4. a way to reopen and change cookie preferences later
5. a cookie policy page that explains the inventory and categories

## Storefront analytics rule

Storefront analytics must not:

- create analytics session cookies
- persist analytics local storage
- send analytics events

until analytics consent is granted.

If analytics consent is later revoked, the client should stop analytics activity and clear client-side storefront analytics identifiers.

## Support guidance

### When someone asks why analytics is not incrementing

Check:

1. whether the shopper granted analytics cookies
2. whether `myrivo_cookie_consent` is present and includes analytics consent
3. whether the storefront analytics access flag for the store is enabled

### When someone asks how to change cookie choices

Direct them to:

- the `Manage cookies` action in the public footer/banner
- the cookie policy page

## Known limitations

- this rollout does not include region-based banner suppression
- this rollout does not include third-party tag management
- this rollout does not include store-specific cookie customization
