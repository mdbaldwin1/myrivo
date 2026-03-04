# Multi-Tenant Runtime

## Overview

Runtime tenant selection is now membership-driven for authenticated dashboard/API flows.

- Active tenant is selected from the signed-in user’s accessible stores.
- Selection is persisted in cookie `myrivo_active_store_slug`.
- If no selected cookie is present, the first accessible store is used.

## Resolution Order

### Dashboard and authenticated APIs

1. Selected store cookie (`myrivo_active_store_slug`) when it matches an accessible store.
2. First accessible store from `store_memberships`.
3. Owner fallback (`stores.owner_user_id`) only when `store_memberships` is unavailable in schema cache.
4. Owner access allowlist fallback for support accounts.

### Storefront APIs

1. `?store=<slug>` query string.
2. `x-store-slug` request header.
3. Selected store cookie (`myrivo_active_store_slug`).
4. `MYRIVO_SINGLE_STORE_SLUG` fallback.

## Store Switching

- Endpoint: `PUT /api/stores/active`
- Body: `{ "slug": "<store-slug>" }`
- Access is validated against the current user’s accessible stores.
- Successful switch sets the active-store cookie for 180 days.

## Safety

- Destructive seed/replay scripts remain blocked unless slug is `test-store`.
- `MYRIVO_SINGLE_STORE_SLUG` is now a fallback default, not the primary runtime selector for authenticated flows.
