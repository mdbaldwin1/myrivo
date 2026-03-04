# Account and Role Model

## Why this model

The platform needs:
- platform operators/admins,
- store owner role,
- customers who may buy from multiple stores.

A single table is not enough for all three role scopes.

## Implemented foundation

### 1) Global user profile

Table: `public.user_profiles`
- `id` (matches `auth.users.id`)
- `email`
- `display_name`
- `global_role` (`user | platform_admin | support`)
- `metadata`

Purpose:
- platform-level roles and profile data.

### 2) Store memberships (per-store roles)

Table: `public.store_memberships`
- `store_id`
- `user_id`
- `role` (`owner`) for now
- `status` (`active | invited | suspended`)

Purpose:
- store-scoped ownership mapping.

### 3) Store customers (store-scoped customer identity)

Table: `public.store_customers`
- `store_id`
- `auth_user_id` (nullable for guests)
- `email`
- `status`
- `metadata`

Purpose:
- supports both guest checkout and logged-in customer accounts.
- customer can exist across multiple stores via separate rows.

## Recommended auth behavior

- Merchant users:
  - sign up once (global account)
  - become `owner` membership for their store
  - no store-level staff/admin roles are enabled right now.
- Customer users:
  - optional global account for convenience
  - linked per store in `store_customers`.

## Admin assignment

Current admin checks support both:
- env-based allowlist (`ADMIN_EMAILS`)
- profile role (`user_profiles.global_role = platform_admin`)

This allows immediate operations now, with migration to DB-driven admin control over time.

## Next implementation steps

1. Add UI to manage store memberships (`owner`) from dashboard.
2. Add customer auth flows:
- guest checkout remains supported
- optional "create account" after purchase
- customer order history view by store.
3. Move fully to DB-managed admin roles (de-emphasize env allowlist).
