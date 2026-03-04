export type BillingReportOrder = {
  id: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  order_fee_breakdowns:
    | {
        subtotal_cents: number;
        platform_fee_cents: number;
        net_payout_cents: number;
        fee_bps: number;
        fee_fixed_cents: number;
        plan_key: string | null;
      }
    | Array<{
        subtotal_cents: number;
        platform_fee_cents: number;
        net_payout_cents: number;
        fee_bps: number;
        fee_fixed_cents: number;
        plan_key: string | null;
      }>
    | null;
};

export type BillingReportIssue = {
  orderId: string;
  createdAt: string;
  severity: "warning" | "critical";
  issue: string;
};

export type BillingReportSummary = {
  orderCount: number;
  paidOrderCount: number;
  grossCents: number;
  platformFeeCents: number;
  netPayoutCents: number;
  reconciliationIssueCount: number;
};

export type BillingReport = {
  summary: BillingReportSummary;
  issues: BillingReportIssue[];
};

function normalizeFeeBreakdown(order: BillingReportOrder) {
  if (!order.order_fee_breakdowns) {
    return null;
  }
  return Array.isArray(order.order_fee_breakdowns) ? (order.order_fee_breakdowns[0] ?? null) : order.order_fee_breakdowns;
}

export function buildBillingReport(orders: BillingReportOrder[]): BillingReport {
  const summary: BillingReportSummary = {
    orderCount: orders.length,
    paidOrderCount: 0,
    grossCents: 0,
    platformFeeCents: 0,
    netPayoutCents: 0,
    reconciliationIssueCount: 0
  };

  const issues: BillingReportIssue[] = [];

  for (const order of orders) {
    summary.grossCents += Math.max(0, order.total_cents ?? 0);
    const feeBreakdown = normalizeFeeBreakdown(order);

    if (order.status === "paid") {
      summary.paidOrderCount += 1;
    }

    if (feeBreakdown) {
      summary.platformFeeCents += Math.max(0, feeBreakdown.platform_fee_cents ?? 0);
      summary.netPayoutCents += Math.max(0, feeBreakdown.net_payout_cents ?? 0);

      if (feeBreakdown.subtotal_cents !== order.subtotal_cents) {
        issues.push({
          orderId: order.id,
          createdAt: order.created_at,
          severity: "warning",
          issue: `Breakdown subtotal (${feeBreakdown.subtotal_cents}) does not match order subtotal (${order.subtotal_cents}).`
        });
      }

      const recomposedSubtotal = Math.max(0, feeBreakdown.platform_fee_cents) + Math.max(0, feeBreakdown.net_payout_cents);
      if (recomposedSubtotal !== feeBreakdown.subtotal_cents) {
        issues.push({
          orderId: order.id,
          createdAt: order.created_at,
          severity: "critical",
          issue: `Platform fee + net payout (${recomposedSubtotal}) does not match fee subtotal (${feeBreakdown.subtotal_cents}).`
        });
      }
    } else if (order.status === "paid") {
      issues.push({
        orderId: order.id,
        createdAt: order.created_at,
        severity: "critical",
        issue: "Paid order is missing fee breakdown snapshot."
      });
    }
  }

  summary.reconciliationIssueCount = issues.length;

  return {
    summary,
    issues: issues.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}
