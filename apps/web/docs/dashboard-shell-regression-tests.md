# Dashboard Shell Regression Tests (`myrivo-4.10`)

## Added Coverage

- `apps/web/e2e/dashboard-shell-layout.spec.ts`
  - Desktop:
    - fixed shell root container (`h-[100dvh]`)
    - explicit dashboard scroll container presence (`data-dashboard-scroll-container`)
    - sticky page header presence on key routes (catalog, orders)
  - Mobile:
    - drawer nav trigger visibility
    - drawer opens with accessible dialog title
    - drawer closes after route navigation

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run -w @myrivo/web e2e -- dashboard-shell-layout.spec.ts` (environment-dependent)
