import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, DollarSign } from "lucide-react";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { hasGlobalRole } from "@/lib/auth/roles";
import { getPlatformRevenueSummary, resolveRevenueRange, type PlatformRevenueRange } from "@/lib/platform/revenue-query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardAdminRevenuePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderRangeLink(currentRange: PlatformRevenueRange, range: PlatformRevenueRange, label: string) {
  return (
    <Link
      key={range}
      href={`/dashboard/admin/revenue?range=${range}`}
      className={cn(buttonVariants({ size: "sm", variant: currentRange === range ? "default" : "outline" }))}
    >
      {label}
    </Link>
  );
}

function getStatusTone(status: string) {
  if (status === "live") return "success" as const;
  if (status === "offline") return "warning" as const;
  if (status === "pending_review") return "warning" as const;
  if (status === "changes_requested" || status === "rejected") return "warning" as const;
  if (status === "suspended") return "danger" as const;
  return "info" as const;
}

export default async function DashboardAdminRevenuePage({ searchParams }: DashboardAdminRevenuePageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();
  const globalRole = profile?.global_role ?? "user";

  if (!hasGlobalRole(globalRole, "support")) {
    redirect("/dashboard");
  }

  const range = resolveRevenueRange(resolvedSearchParams.range);
  const summary = await getPlatformRevenueSummary({
    supabase: createSupabaseAdminClient() as unknown as { from: (table: string) => import("@/lib/platform/revenue-query").QueryBuilder },
    range
  });

  return (
    <DashboardPageScaffold
      title="Revenue"
      description="Platform GMV, fee revenue, payout flow, refunds, and disputes."
      className="space-y-4 p-3"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {renderRangeLink(range, "7d", "7d")}
          {renderRangeLink(range, "30d", "30d")}
          {renderRangeLink(range, "90d", "90d")}
        </div>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DataStat label="GMV" value={formatMoney(summary.headline.gmvCents)} className="bg-card" />
        <DataStat label="Platform Fees" value={formatMoney(summary.headline.platformFeeCents)} className="bg-card" />
        <DataStat label="Net Payout" value={formatMoney(summary.headline.netPayoutCents)} className="bg-card" />
        <DataStat label="Refunded" value={formatMoney(summary.headline.refundedCents)} className="bg-card" />
        <DataStat
          label="Active Disputes"
          value={`${summary.headline.activeDisputeCount} · ${formatMoney(summary.headline.activeDisputeAmountCents)}`}
          className="bg-card"
        />
        <DataStat label="Take Rate" value={formatPercent(summary.headline.takeRate)} className="bg-card" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataStat label="Paid Orders" value={String(summary.headline.ordersCount)} className="bg-card" />
        <DataStat label="Average Order" value={formatMoney(summary.headline.averageOrderValueCents)} className="bg-card" />
        <DataStat label="Range Starts" value={new Date(summary.since).toLocaleDateString()} className="bg-card" />
        <DataStat label="Focus" value="Transaction fees" className="bg-card" />
      </section>

      <SectionCard
        title="Top Stores by Fee Revenue"
        description="Stores contributing the most transaction-fee revenue in the selected range."
        action={
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/dashboard/admin/stores">Open Stores</Link>
          </Button>
        }
      >
        {summary.topStores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid order activity in this range yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Net payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.topStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium">{store.name}</p>
                      <p className="text-xs text-muted-foreground">{store.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusChip label={store.status.replaceAll("_", " ")} tone={getStatusTone(store.status)} />
                  </TableCell>
                  <TableCell className="text-right">{store.ordersCount}</TableCell>
                  <TableCell className="text-right">{formatMoney(store.gmvCents)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(store.platformFeeCents)}</TableCell>
                  <TableCell className="text-right">{formatMoney(store.netPayoutCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Recent Refunds and Disputes" description="Recent financial adjustments and payment risk signals across the platform.">
        {summary.recentAdjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refunds or disputes recorded in this range yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.recentAdjustments.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {item.kind === "refund" ? <DollarSign className="h-4 w-4 text-muted-foreground" /> : <BarChart3 className="h-4 w-4 text-muted-foreground" />}
                      <span className="capitalize">{item.kind}</span>
                    </span>
                  </TableCell>
                  <TableCell>{item.store?.name ?? "Unknown store"}</TableCell>
                  <TableCell className="font-mono text-xs">{item.orderId.slice(0, 8)}</TableCell>
                  <TableCell>{item.status.replaceAll("_", " ")}</TableCell>
                  <TableCell>{item.reason ? item.reason.replaceAll("_", " ") : "-"}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.amountCents, item.currency)}</TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </DashboardPageScaffold>
  );
}
