type PeriodSummary = {
  grossRevenueCents: number;
  orderCount: number;
  avgOrderValueCents: number;
};

function toPctDelta(current: number, previous: number): number | "new" | null {
  if (previous === 0) {
    return current === 0 ? 0 : "new";
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function buildPeriodDelta(current: PeriodSummary, previous: PeriodSummary) {
  return {
    grossRevenuePct: toPctDelta(current.grossRevenueCents, previous.grossRevenueCents),
    orderCountPct: toPctDelta(current.orderCount, previous.orderCount),
    avgOrderValuePct: toPctDelta(current.avgOrderValueCents, previous.avgOrderValueCents)
  };
}
