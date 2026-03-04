# Test Environment Setup

This project runs as a single storefront at runtime, but the database supports multiple stores.
For now, testing is isolated in the same Supabase project by using a dedicated test store slug (for example `test-store`).
Do not modify or delete your live store (for example `curby`) while running this flow.

## 1) Create test env file

Copy the template:

```bash
cp .env.local.test.example .env.local.test
```

Fill in the test Supabase values and owner credentials:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MYRIVO_SINGLE_STORE_SLUG=test-store` (or your test slug)
- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`

## 2) Run migrations

Use your standard Supabase CLI workflow before first use.

## 3) Bootstrap the test store + owner

```bash
npm run setup:test-env
```

This script creates/updates (scoped to the configured test slug):

- owner auth user (`E2E_OWNER_EMAIL`)
- test store (`MYRIVO_SINGLE_STORE_SLUG`)
- baseline branding/settings
- `WELCOME10` promotion

## 4) Switch active app env to test

```bash
npm run env:test
```

This copies `.env.local.test` to:

- `.env.local` (backup: `.env.local.backup`)
- `apps/web/.env.local` (backup: `apps/web/.env.local.backup`)

Both targets are kept in sync for local app runtime and E2E helper compatibility.

## 5) Run E2E safely

```bash
npm run e2e:test
```

When logged into dashboard, use the `Active Store` switcher in the header to move between test and production stores without changing env files.

## 6) Switch back to production env

Create and maintain `.env.local.prod`, then:

```bash
npm run env:prod
```

## Safety Notes

- Keep production and test store slugs different (`curby` vs `test-store`).
- Seed/replay scripts are hard-blocked unless `MYRIVO_SINGLE_STORE_SLUG=test-store`.
- E2E owner fallback password reset is disabled by default.
- To allow reset explicitly (not recommended on real data), set:
  - `E2E_ALLOW_OWNER_PASSWORD_RESET=true`
