import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { PlatformControlsSettings } from "@/components/dashboard/platform-controls-settings";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasStorePermission } from "@/lib/auth/roles";
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
  billing_mode: "platform" | "manual";
  test_mode_enabled: boolean;
  fee_override_bps: number | null;
  fee_override_fixed_cents: number | null;
  billing_plans: BillingPlanSnapshot | BillingPlanSnapshot[] | null;
};

type BillingEventRow = {
  id: string;
  event_type: string;
  source: string | null;
  occurred_at: string;
  created_at: string;
  payload_json: Record<string, unknown>;
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

  const canManageBilling = hasStorePermission(bundle.role, bundle.permissionsJson, "store.manage_billing");

  const [{ data: orders, error: ordersError }, { data: events, error: eventsError }, { data: billingProfile, error: billingError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,status,subtotal_cents,total_cents,currency,created_at,order_fee_breakdowns(subtotal_cents,platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)"
        )
        .eq("store_id", bundle.store.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("billing_events")
        .select("id,event_type,source,occurred_at,created_at,payload_json")
        .eq("store_id", bundle.store.id)
        .order("occurred_at", { ascending: false })
        .limit(50)
        .returns<BillingEventRow[]>(),
      supabase
        .from("store_billing_profiles")
        .select("billing_mode,test_mode_enabled,fee_override_bps,fee_override_fixed_cents,billing_plans(key,name,monthly_price_cents,transaction_fee_bps,transaction_fee_fixed_cents)")
        .eq("store_id", bundle.store.id)
        .maybeSingle<StoreBillingSnapshot>()
    ]);

  if (ordersError) {
    throw new Error(ordersError.message);
  }
  if (eventsError) {
    throw new Error(eventsError.message);
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
        description={`Fee reporting, reconciliation status, and billing controls for ${bundle.store.name}.`}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DataStat label="Orders In Report" value={String(report.summary.orderCount)} />
        <DataStat label="Paid Orders" value={String(report.summary.paidOrderCount)} />
        <DataStat label="Gross Revenue" value={formatCurrency(report.summary.grossCents, reportCurrency)} />
        <DataStat label="Platform Fees" value={formatCurrency(report.summary.platformFeeCents, reportCurrency)} />
        <DataStat label="Net Payout" value={formatCurrency(report.summary.netPayoutCents, reportCurrency)} />
      </div>

      <SectionCard title="Reconciliation Health">
        {report.issues.length === 0 ? (
          <p className="text-sm text-emerald-700">No reconciliation issues found in the latest 200 orders.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-amber-700">
              {report.summary.reconciliationIssueCount} issue(s) detected. Review and resolve before payout reconciliation.
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
          </div>
        )}
      </SectionCard>

      <SectionCard title="Billing Profile Snapshot">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="font-medium">Mode:</span> {billingProfile?.billing_mode ?? "platform"}
          </p>
          <p>
            <span className="font-medium">Test mode:</span> {billingProfile?.test_mode_enabled ? "Enabled" : "Disabled"}
          </p>
          <p>
            <span className="font-medium">Plan:</span> {plan?.name ?? plan?.key ?? "Not configured"}
          </p>
          <p>
            <span className="font-medium">Default fee:</span>{" "}
            {plan ? `${(plan.transaction_fee_bps / 100).toFixed(2)}% + ${formatCurrency(plan.transaction_fee_fixed_cents, reportCurrency)}` : "Not configured"}
          </p>
          <p>
            <span className="font-medium">Override fee bps:</span> {billingProfile?.fee_override_bps ?? "none"}
          </p>
          <p>
            <span className="font-medium">Override fixed cents:</span> {billingProfile?.fee_override_fixed_cents ?? "none"}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Recent Billing Events">
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No billing events recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Occurred</TableHead>
                <TableHead>Payload Keys</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events ?? []).map((event) => {
                const payloadKeys =
                  event.payload_json && typeof event.payload_json === "object" && !Array.isArray(event.payload_json)
                    ? Object.keys(event.payload_json).slice(0, 5)
                    : [];
                return (
                  <TableRow key={event.id}>
                    <TableCell>{event.event_type}</TableCell>
                    <TableCell>{event.source ?? "-"}</TableCell>
                    <TableCell>{new Date(event.occurred_at).toLocaleString()}</TableCell>
                    <TableCell>{payloadKeys.length > 0 ? payloadKeys.join(", ") : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {canManageBilling ? (
        <PlatformControlsSettings />
      ) : (
        <SectionCard title="Billing Controls">
          <p className="text-sm text-muted-foreground">Your role can view billing reports, but only admins can modify billing controls.</p>
        </SectionCard>
      )}
    </section>
  );
}
