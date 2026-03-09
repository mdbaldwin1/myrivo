# Notifications Implementation Plan

## Objectives

1. Deliver actionable notifications for store owners and customers.
2. Respect user-level preferences already exposed in account settings.
3. Centralize event -> notification logic so channels (in-app, email, future SMS/push) are pluggable.
4. Keep phase 1 low-risk by using existing infrastructure (audit events, server routes, email sender abstraction).

## Current State (as of March 2026)

1. Transactional order emails exist:
   - Order confirmation
   - Owner new order alert
   - Shipped/delivered updates
2. Account settings has basic notification preferences:
   - `weeklyDigestEmails`
   - `productAnnouncements`
3. No true in-app notification center/inbox exists.
4. Dashboard "alerts" are computed UI modules, not persisted user notifications.
5. `audit_events` is already written by key workflows and can seed notification events.

## Product Scope

### Owner Notifications

1. New order placed.
2. Pickup selected (with pickup window) and pickup changes.
3. Shipping state changes and tracking exceptions.
4. Inventory risk:
   - Out of stock
   - Low stock threshold crossed
5. Domain/email/checkout/storefront setup warnings.
6. Team/invite actions:
   - Invitation accepted
   - Role changed

### Customer Notifications

1. Order lifecycle (existing email channel already implemented).
2. Pickup reminder before selected pickup window.
3. Shipping exceptions (delayed/returned) once webhook data supports it.

### Platform/Product Communications

1. Weekly digest (owner account setting already exists).
2. Product announcements (owner account setting already exists).

## Channel Strategy

1. Phase 1 channels:
   - In-app inbox (owner only)
   - Email (owner and customer where applicable)
2. Phase 2 channels:
   - Web push and/or SMS (optional future)

## Proposed Data Model

Add a notification domain model instead of overloading `audit_events`.

1. `notifications`
   - `id uuid`
   - `store_id uuid null`
   - `recipient_user_id uuid`
   - `recipient_email text null`
   - `event_type text`
   - `title text`
   - `body text`
   - `action_url text null`
   - `severity text check (info|warning|critical)`
   - `channel_targets jsonb` (e.g. `{ "inApp": true, "email": true }`)
   - `status text check (pending|sent|failed|dismissed|read)`
   - `read_at timestamptz null`
   - `sent_at timestamptz null`
   - `dedupe_key text null`
   - `metadata jsonb`
   - timestamps
2. `notification_delivery_attempts`
   - `notification_id`
   - `channel` (`inApp|email`)
   - `provider` (`resend`, future providers)
   - `status` (`sent|failed`)
   - `error text null`
   - `response_json jsonb`
   - timestamp
3. Extend `user_profiles.metadata.account_preferences` schema:
   - Keep existing keys
   - Add channel/event toggles:
     - `orderAlertsEmail`
     - `orderAlertsInApp`
     - `inventoryAlertsEmail`
     - `inventoryAlertsInApp`
     - `systemAlertsEmail`
     - `systemAlertsInApp`

## Architecture

1. `lib/notifications/catalog.ts`
   - Event catalog, copy defaults, severity, default channel map.
2. `lib/notifications/preferences.ts`
   - Preference resolution with defaults + migration-safe fallback.
3. `lib/notifications/dispatcher.ts`
   - Accepts event payload and recipient context.
   - Resolves preferences.
   - Creates `notifications` record.
   - Sends channel deliveries (email via `email-provider.ts`, in-app direct persist).
4. `lib/notifications/triggers/*`
   - Thin adapters called from existing workflows:
     - checkout finalization
     - shipping update routes/webhook
     - inventory mutation flows
     - team invite acceptance

## UX Plan

1. Add notification bell + unread count in dashboard header.
2. Add `/dashboard/notifications` page:
   - Unread/read filters
   - Severity badges
   - Action links
   - Mark read / mark all read
3. Expand settings page preferences:
   - Replace two toggles with grouped preferences by category/channel.
   - Keep current toggles mapped for backward compatibility.

## Rollout Phases

### Phase 0: Foundation

1. Add migrations for notification tables.
2. Add typed notification models in `apps/web/types/database.ts`.
3. Add notification catalog + dispatcher skeleton with no-op triggers.

### Phase 1: In-App Owner Notifications

1. Wire triggers for:
   - new order
   - shipping status updates
   - pickup schedule updates
2. Persist notifications with dedupe keys.
3. Build notifications page + bell badge.

### Phase 2: Preference Enforcement

1. Expand preferences schema and API validation.
2. Apply preference checks in dispatcher.
3. Add settings UI for notification categories and channels.

### Phase 3: Email Expansion

1. Use dispatcher for owner email alerts (instead of direct one-off sends where appropriate).
2. Keep customer transactional emails as mandatory operational messages.
3. Add weekly digest job respecting `weeklyDigestEmails`.

### Phase 4: Inventory + System Alerts

1. Inventory threshold event generation.
2. Domain/checkout/setup lifecycle alerts routed to inbox and optional email.
3. Rate-limiting and dedupe windows to avoid alert fatigue.

## Validation and Quality Gates

1. Unit tests:
   - preference resolution
   - dedupe behavior
   - channel routing decisions
2. Integration tests:
   - trigger route emits notification row
   - notification read/dismiss endpoints
3. Regression tests:
   - existing order emails unchanged for customer critical flows
4. Observability:
   - log notification dispatch failures
   - basic dashboard metric: sent/failed by channel

## Suggested First Build Slice (1 week)

1. Add `notifications` + `notification_delivery_attempts` migrations.
2. Build inbox page with read/unread state.
3. Emit in-app notifications for:
   - new order
   - shipped/delivered
4. Add header unread badge.
5. Keep settings untouched in slice 1; use defaults.

This gives immediate user-visible value with minimal delivery risk.
