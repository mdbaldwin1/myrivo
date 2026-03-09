# Store Experience Cutover Plan

## Objective

Replace the current mixed settings architecture with a clean split:

- `Store Settings`: low-frequency controls (look + behavior defaults)
- `Content Workspace`: high-frequency content editing
- `Marketing`: promotions and subscriber operations

This cutover intentionally does **not** preserve backward compatibility in app architecture. We will migrate existing single-store data into the new model and switch all reads/writes to the new model.

## Information Architecture

### Store Settings (rarely changed)

- Profile
  - Store name
  - Store logo
  - Store status
- Branding
  - Color system
  - Typography / spacing / radius
  - Global header/footer structure + nav composition
- Checkout Rules
  - Fulfillment options and fee behavior
  - Order note behavior
- Integrations
  - Stripe Connect status/actions
  - Shipping provider credentials/webhooks

### Content Workspace (frequently changed)

- Home
  - Hero copy
  - Home section visibility
  - Content blocks
- Products Page
  - Page-level merchandising copy and labels
  - Empty state and helper text
- About Page
  - Article content
  - Structured sections
- Policies Page
  - Shipping/returns/support copy
  - Policy FAQs
- Cart Page
  - Cart page copy
- Order Summary Page
  - Checkout confirmation copy
- Emails
  - Newsletter capture copy
  - Transactional email templates/copy

### Marketing

- Promotions
- Email subscribers

### Outside Store Experience

- Catalog remains top-level operations and is explicitly not part of Store Settings.

## Target Data Model

We introduce a sectioned store-experience content model:

- `store_experience_content`
  - `home_json`
  - `products_page_json`
  - `about_page_json`
  - `policies_page_json`
  - `cart_page_json`
  - `order_summary_page_json`
  - `emails_json`

Existing operational tables remain:

- `stores`, `store_branding`, `store_integrations`, `promotions`, `store_email_subscribers`, catalog/order tables.

## Bead Plan (Cutover Mode)

### Bead A: Architecture and Contracts

- Deliverables
  - Final route map for Store Settings / Content Workspace / Marketing
  - Domain types and zod contracts for every section payload
  - Error taxonomy and API response standard
- Acceptance
  - Approved architecture spec + route inventory
  - No unresolved schema/ownership ambiguities

### Bead B: Data Safety Tooling

- Deliverables
  - Snapshot script for existing store experience data
  - Replay script for deterministic re-application
  - JSON snapshot schema/versioning
- Acceptance
  - Snapshot + replay run cleanly in local/staging
  - Deterministic replay output verified

### Bead C: Schema Migration

- Deliverables
  - Supabase migration creating `store_experience_content`
  - SQL backfill from current settings/branding/content
  - Indexes + RLS + triggers
- Acceptance
  - Backfilled row present for every store
  - New content reads can rely on sectioned source

### Bead D: API Cutover

- Deliverables
  - New section-scoped APIs (settings/content/marketing as separate surfaces)
  - Remove legacy mixed payload coupling
- Acceptance
  - API tests pass for happy + failure paths
  - Legacy mixed editors are not required by UI

### Bead E: Dashboard UI Cutover

- Deliverables
  - New nav groups and pages
  - Content Workspace editors replacing raw JSON editing
  - Promotions moved into Marketing
- Acceptance
  - All experience configuration reachable from the new IA
  - Settings area contains only low-frequency controls

### Bead F: Storefront + Notification Consumers

- Deliverables
  - Storefront readers consume `store_experience_content`
  - Email notifications consume structured email content config
- Acceptance
  - Home/products/about/policies/cart/checkout/order summary render correctly
  - Transactional emails render expected copy

### Bead G: Cleanup and Hardening

- Deliverables
  - Remove obsolete code paths and legacy editor code
  - Final docs, runbooks, and QA checklist
- Acceptance
  - Lint/typecheck/tests/e2e pass
  - No temporary compatibility shims remain

## Quality Bar (Per Bead)

- Strong typing end-to-end (DB types + DTOs + zod runtime validation)
- Explicit error handling with actionable user-facing feedback
- Failure-path tests for APIs and transformations
- No TODO stubs in merged code
- Verification report with commands run and outcomes

## Verification Commands

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run -w @myrivo/web e2e`

## Data Migration Safety Procedure (Single Store)

1. Export current experience snapshot with script.
2. Store snapshot artifact under `memory/store-experience-snapshots/`.
3. Apply migration + cutover.
4. Replay snapshot data when needed.
5. Run storefront parity checks on:
   - `/`
   - `/products`
   - `/about`
   - `/policies`
   - `/cart`
   - `/checkout`
