import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildBillingReport, type BillingReportOrder } from "@/lib/billing/reporting";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

type BillingPlanSnapshot = {
  key: string;
  name: string;
  monthly_price_cents: number;
  transaction_fee_bps: number;
  transaction_fee_fixed_cents: number;
};

type StoreBillingSnapshot = {
  billing_plans: BillingPlanSnapshot | BillingPlanSnapshot[] | null;
};

function normalizeBillingPlan(plan: StoreBillingSnapshot["billing_plans"]): BillingPlanSnapshot | null {
  if (!plan) {
    return null;
  }

  return Array.isArray(plan) ? (plan[0] ?? null) : plan;
}

export default async function DashboardBillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return null;
  }

  const [{ data: orders, error: ordersError }, { data: billingProfile, error: billingError }] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,status,subtotal_cents,total_cents,currency,created_at,order_fee_breakdowns(subtotal_cents,platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)"
        )
        .eq("store_id", bundle.store.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("store_billing_profiles")
        .select("billing_plans(key,name,monthly_price_cents,transaction_fee_bps,transaction_fee_fixed_cents)")
        .eq("store_id", bundle.store.id)
        .maybeSingle<StoreBillingSnapshot>()
    ]);

  if (ordersError) {
    throw new Error(ordersError.message);
  }
  if (billingError) {
    throw new Error(billingError.message);
  }

  const report = buildBillingReport((orders ?? []) as BillingReportOrder[]);
  const plan = normalizeBillingPlan(billingProfile?.billing_plans ?? null);
  const reportCurrency = ((orders ?? [])[0] as { currency?: string } | undefined)?.currency ?? "usd";

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Billing"
        description={`Fee reporting and billing events for ${bundle.store.name}.`}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DataStat label="Orders In Report" value={String(report.summary.orderCount)} />
        <DataStat label="Paid Orders" value={String(report.summary.paidOrderCount)} />
        <DataStat label="Gross Revenue" value={formatCurrency(report.summary.grossCents, reportCurrency)} />
        <DataStat label="Platform Fees" value={formatCurrency(report.summary.platformFeeCents, reportCurrency)} />
        <DataStat label="Net Payout" value={formatCurrency(report.summary.netPayoutCents, reportCurrency)} />
      </div>

      {plan ? (
        <SectionCard title="Current Platform Fee">
          <p className="text-sm text-muted-foreground">
            {plan.name}: {(plan.transaction_fee_bps / 100).toFixed(2)}% + {formatCurrency(plan.transaction_fee_fixed_cents, reportCurrency)} per successful order.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title="Reports">
        <p className="text-sm text-muted-foreground">Detailed billing event history is now in the Reports workspace.</p>
        <div className="mt-3">
          <Link href="/dashboard/reports/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open Billing Events Report
          </Link>
        </div>
      </SectionCard>

      {report.issues.length > 0 ? (
        <SectionCard title="Billing Data Issues">
          <p className="mb-3 text-sm text-amber-700">
            {report.summary.reconciliationIssueCount} issue(s) were detected in recent order fee snapshots.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.issues.map((issue) => (
                <TableRow key={`${issue.orderId}-${issue.issue}`}>
                  <TableCell className={issue.severity === "critical" ? "text-red-600" : "text-amber-700"}>{issue.severity}</TableCell>
                  <TableCell>#{issue.orderId.slice(0, 8)}</TableCell>
                  <TableCell>{issue.issue}</TableCell>
                  <TableCell>{new Date(issue.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      ) : null}
    </section>
  );
}
