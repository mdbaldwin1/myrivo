# Store Dashboard Redesign - Implementation Spec

## Objective

Redesign `/dashboard/stores/[storeSlug]` into a high-signal operational control tower that improves:

- Speed to identify urgent work
- Speed to resolve operational blockers
- Revenue and fulfillment decision quality

This spec intentionally does not reuse current page composition as the design baseline.

## Scope

In scope:

- New information architecture for the store dashboard root route
- New data aggregation layer for dashboard modules
- New UI modules and layout system
- Progressive delivery in phased PRs
- Test coverage for rendering, interactions, and regressions

Out of scope (phase 2+):

- Net-new analytics tables for traffic/conversion attribution
- Advanced forecasting models
- Full widget personalization

## User Roles and Primary Jobs

- `owner/admin`: business health, readiness blockers, strategic performance, growth
- `staff`: operational queue, fulfillment actions, inventory risk, immediate tasks

Primary jobs-to-be-done:

1. Know what is urgent right now.
2. Know if store is healthy and ready to sell.
3. Know what changed versus last period.
4. Take action in one click.

## Target IA (Single Page)

1. Command Bar
2. Priority Alerts Rail
3. Today Operations Board
4. Performance Overview
5. Inventory Risk
6. Growth Snapshot
7. Store Health Score + Checklist
8. Activity Timeline

## Layout Blueprint

- Desktop (`xl`): 12-column grid
- Tablet (`md/lg`): 6-column grid
- Mobile (`sm`): single column, alert-first order

Desktop placement:

- Row 1: Command bar (full width)
- Row 2: Alerts rail (full width)
- Row 3: Operations board (8 cols) + Health score (4 cols)
- Row 4: Performance (8 cols) + Growth (4 cols)
- Row 5: Inventory (8 cols) + Timeline (4 cols)

## Component and File Map

Follow one-component-per-file.

Route:

- `apps/web/app/dashboard/stores/[storeSlug]/page.tsx` (server page composition only)

Data layer:

- `apps/web/lib/dashboard/store-dashboard/get-store-dashboard-data.ts`
- `apps/web/lib/dashboard/store-dashboard/store-dashboard-types.ts`
- `apps/web/lib/dashboard/store-dashboard/build-alerts.ts`
- `apps/web/lib/dashboard/store-dashboard/build-health-score.ts`

Dashboard UI shell:

- `apps/web/components/dashboard/store-dashboard/store-dashboard-shell.tsx`
- `apps/web/components/dashboard/store-dashboard/store-dashboard-command-bar.tsx`
- `apps/web/components/dashboard/store-dashboard/store-dashboard-grid.tsx`

Modules:

- `apps/web/components/dashboard/store-dashboard/modules/priority-alerts-panel.tsx`
- `apps/web/components/dashboard/store-dashboard/modules/today-operations-panel.tsx`
- `apps/web/components/dashboard/store-dashboard/modules/performance-overview-panel.tsx`
- `apps/web/components/dashboard/store-dashboard/modules/inventory-risk-panel.tsx`
- `apps/web/components/dashboard/store-dashboard/modules/growth-snapshot-panel.tsx`
- `apps/web/components/dashboard/store-dashboard/modules/store-health-panel.tsx`
- `apps/web/components/dashboard/store-dashboard/modules/activity-timeline-panel.tsx`

UI primitives (if needed):

- `apps/web/components/ui/kpi-stat.tsx`
- `apps/web/components/ui/trend-delta.tsx`
- `apps/web/components/ui/severity-pill.tsx`
- `apps/web/components/ui/task-row.tsx`

Tests:

- `apps/web/components/dashboard/store-dashboard/__tests__/build-alerts.test.ts`
- `apps/web/components/dashboard/store-dashboard/__tests__/build-health-score.test.ts`
- `apps/web/components/dashboard/store-dashboard/__tests__/store-dashboard-shell.test.tsx`
- `apps/web/e2e/store-dashboard-control-tower.spec.ts`

## Data Contract (Server -> UI)

Create one typed payload returned by `getStoreDashboardData`.

```ts
export type StoreDashboardDateRange = "today" | "7d" | "30d";

export type StoreDashboardData = {
  store: {
    id: string;
    slug: string;
    name: string;
    status: "draft" | "active" | "suspended";
  };
  filters: {
    range: StoreDashboardDateRange;
    compare: boolean;
    generatedAt: string;
  };
  alerts: Array<{
    id: string;
    severity: "critical" | "high" | "medium";
    title: string;
    detail: string;
    actionLabel: string;
    actionHref: string;
  }>;
  operations: {
    pendingFulfillment: number;
    packing: number;
    shippingExceptions: number;
    overdueFulfillment: number;
    duePickupWindows: number;
    nextTasks: Array<{
      id: string;
      label: string;
      href: string;
      priority: "critical" | "high" | "medium";
    }>;
  };
  performance: {
    grossRevenueCents: number;
    netPayoutCents: number;
    orderCount: number;
    paidOrderCount: number;
    avgOrderValueCents: number;
    discountCents: number;
    periodDelta?: {
      grossRevenuePct: number | null;
      orderCountPct: number | null;
      avgOrderValuePct: number | null;
    };
    dailySeries: Array<{ date: string; grossRevenueCents: number; orders: number }>;
    topProducts: Array<{ productId: string; title: string; revenueCents: number; units: number }>;
  };
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: Array<{ productId: string; title: string; qty: number }>;
  };
  growth: {
    subscribersTotal: number;
    subscribersNetNew: number;
    activePromotions: number;
    promotionsRedeemed: number;
  };
  health: {
    score: number; // 0-100
    checks: Array<{
      id: string;
      label: string;
      status: "ready" | "action_needed";
      href: string;
      weight: number;
    }>;
  };
  timeline: Array<{
    id: string;
    at: string;
    kind: "order" | "inventory" | "billing" | "settings" | "domain";
    title: string;
    detail: string;
    href?: string;
  }>;
};
```

## Data Sources and Query Plan

Use existing tables first:

- `orders`, `order_items`, `order_fee_breakdowns`
- `products`, `inventory_movements`
- `store_email_subscribers`, `promotions`
- `store_domains`, `store_settings`, `store_branding`, `stores`
- `audit_events`, `billing_events`

Loader strategy:

1. Resolve store access using existing `getOwnedStoreBundleForSlug`.
2. Run independent queries in `Promise.all`.
3. Build derived aggregates in pure functions (`build-alerts`, `build-health-score`).
4. Return stable payload shape for UI.

Performance constraints:

- Cap expensive lists (timeline/events) to latest 50.
- Use date filters in SQL (`gte created_at`) for selected range.
- Keep server-side aggregation O(n) over bounded result sets.

## Alert Rules (v1)

`critical`:

- Payments not ready (`stripe account missing` or `readyForLiveCheckout = false`)
- Verified primary domain missing for active store
- Overdue fulfillment queue > threshold (default: > 0 older than 8h)

`high`:

- Out-of-stock active products > 0
- Shipping exceptions > 0

`medium`:

- Onboarding incomplete steps
- SEO essentials missing

Each alert must include direct action CTA.

## Health Score Rules (v1)

Weighted checklist (100 total):

- Payments ready: 30
- Primary domain verified: 20
- At least one active product: 15
- Checkout method configured (pickup or shipping): 15
- SEO title + description present: 10
- Support email present: 10

`score = sum(ready weights)`.

## Interaction/UX Requirements

- Date range control: `today`, `7d`, `30d`
- Compare toggle: previous equivalent period
- Module-level empty states must include an action
- All module headings include one-line operational purpose
- Keyboard accessible controls and semantic headings
- Mobile-first stacking order: Alerts -> Operations -> Health -> Performance -> Inventory -> Growth -> Timeline

## Visual System Requirements

- Reuse existing Tailwind token system in `globals.css`
- Increase hierarchy contrast using:
  - Severity color lanes for alerts
  - Large KPI typography only for top-line metrics
  - Compact secondary stats
- Avoid repetitive same-weight cards
- Preserve existing dashboard shell/nav patterns

## Delivery Plan (PR-Ready Tickets)

### Phase 0 - Foundation

`chore:` dashboard baseline and contracts

1. Add `store-dashboard-types.ts`.
2. Add `get-store-dashboard-data.ts` with placeholder values + typed contract.
3. Wire route to new shell component with fallback to current overview behind flag.

Validation:

- `npm run lint`
- `npm run typecheck`
- `npm test`

### Phase 1 - Core Control Tower (highest value)

`feat:` control tower layout and core modules

1. Implement command bar, alerts rail, operations panel, health panel.
2. Implement alert builder and health score builder.
3. Add CTA links to existing routes (`orders`, `store-settings/*`, `catalog`).

Validation:

- Unit tests for alert and health scoring logic
- Screenshot/assertion test for critical modules rendering

### Phase 2 - Performance and Inventory

`feat:` business performance and inventory risk modules

1. Add performance metrics + trend + top products.
2. Add inventory risk summary.
3. Add compare-period deltas.

Validation:

- Unit tests for aggregate math and delta math
- E2E check for range switch updating key metrics

### Phase 3 - Growth and Timeline

`feat:` growth snapshot and unified activity feed

1. Add subscriber/promotion growth module.
2. Add timeline module from `audit_events` + `billing_events` + order/inventory highlights.

Validation:

- E2E: dashboard shows recent operational events after actions

### Phase 4 - Hardening and UX polish

`refactor:` accessibility, loading states, and resilience

1. Skeleton loading states per module.
2. Error boundaries and module-level retries.
3. Final responsive polish and keyboard pass.

Validation:

- `npm run build`
- `npm run e2e --workspace=@myrivo/web`
- Manual keyboard and screen-reader smoke check

## Ticket Breakdown (Execution Units)

Use these as individual issues/PRs:

1. `feat: add typed store dashboard data contract and loader`
2. `feat: add store dashboard control tower shell and layout grid`
3. `feat: add priority alert engine and alert panel`
4. `feat: add operations board with actionable task list`
5. `feat: add store health score with weighted checklist`
6. `feat: add performance overview with range and compare deltas`
7. `feat: add inventory risk panel`
8. `feat: add growth snapshot panel`
9. `feat: add unified activity timeline panel`
10. `test: add unit and e2e coverage for store dashboard control tower`

## Testing Strategy

Unit:

- Derived metric calculations
- Alert severity and rule triggering
- Health score weighting and edge cases

Integration:

- Route-level render with mocked payload
- Filter state propagation to modules

E2E:

- Merchant lands on store dashboard and sees urgent alert when setup incomplete
- Completing setup removes alert and increases health score
- Range toggle changes KPI values
- CTA links route to correct destination

## Risks and Mitigations

- Risk: Query bloat and slower TTFB
  - Mitigation: bounded queries, parallel fetches, avoid unbounded joins

- Risk: Metric drift with other reports pages
  - Mitigation: centralize aggregate helpers and reuse in reports

- Risk: Alert fatigue
  - Mitigation: strict severity rules, hide low-value warnings from top rail

- Risk: Inconsistent role expectations
  - Mitigation: role-aware CTA prioritization in operations panel

## Rollout Plan

1. Ship behind temporary feature flag `NEXT_PUBLIC_STORE_DASHBOARD_V2`.
2. Enable for internal users first.
3. Collect baseline metrics (task completion time, queue clearance time).
4. Roll out to all stores.
5. Remove old overview components after one stable cycle.

## Definition of Done

- New dashboard route is fully powered by `StoreDashboardData`.
- Critical operational blockers are visible within first viewport.
- All modules have empty/error/loading states.
- Tests added for aggregate logic + key e2e flow.
- Lint/typecheck/tests/build pass for touched workspace.
