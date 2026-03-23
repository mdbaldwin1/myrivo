import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DataStat } from "@/components/ui/data-stat";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDisputeStatusLabel, getRefundStatusLabel } from "@/lib/orders/refunds";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderDisputeRecord, OrderRefundRecord } from "@/types/database";

export const dynamic = "force-dynamic";

type BillingEventRow = {
  id: string;
  event_type: string;
  source: string | null;
  occurred_at: string;
  created_at: string;
  payload_json: Record<string, unknown>;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

function getRefundStatusTone(status: OrderRefundRecord["status"]) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed" || status === "cancelled") return "danger" as const;
  if (status === "processing") return "info" as const;
  return "warning" as const;
}

function getDisputeStatusTone(status: OrderDisputeRecord["status"]) {
  if (status === "won" || status === "prevented" || status === "warning_closed") return "success" as const;
  if (status === "lost") return "danger" as const;
  if (status === "needs_response" || status === "warning_needs_response") return "warning" as const;
  return "info" as const;
}

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceReportsBillingPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug);
  if (!bundle) {
    return null;
  }

  const { data: events, error: eventsError } = await supabase
    .from("billing_events")
    .select("id,event_type,source,occurred_at,created_at,payload_json")
    .eq("store_id", bundle.store.id)
    .order("occurred_at", { ascending: false })
    .limit(200)
    .returns<BillingEventRow[]>();

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const { data: refunds, error: refundsError } = await supabase
    .from("order_refunds")
    .select("id,order_id,store_id,requested_by_user_id,processed_by_user_id,amount_cents,reason_key,reason_note,customer_message,status,stripe_refund_id,metadata_json,processed_at,created_at,updated_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<OrderRefundRecord[]>();

  if (refundsError) {
    throw new Error(refundsError.message);
  }

  const { data: disputes, error: disputesError } = await supabase
    .from("order_disputes")
    .select("id,order_id,store_id,stripe_dispute_id,stripe_charge_id,stripe_payment_intent_id,amount_cents,currency,reason,status,is_charge_refundable,response_due_by,metadata_json,closed_at,created_at,updated_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<OrderDisputeRecord[]>();

  if (disputesError) {
    throw new Error(disputesError.message);
  }

  const refundItems = refunds ?? [];
  const disputeItems = disputes ?? [];
  const refundedTotalCents = refundItems
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const pendingRefundCount = refundItems.filter((refund) => refund.status === "requested" || refund.status === "processing").length;
  const responseNeededDisputeCount = disputeItems.filter(
    (dispute) => dispute.status === "needs_response" || dispute.status === "warning_needs_response"
  ).length;
  const activeDisputeCount = disputeItems.filter((dispute) => !["won", "lost", "prevented", "warning_closed"].includes(dispute.status)).length;
  const billingCurrency = refundItems[0]?.metadata_json && typeof refundItems[0]?.metadata_json === "object" ? "usd" : "usd";

  return (
    <section className="space-y-3 p-3">
      <DashboardPageHeader title="Billing" description="Billing event history for auditability and support troubleshooting." />
      <section aria-label="Refund and dispute summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataStat label="Refunded" value={formatMoney(refundedTotalCents, billingCurrency)} className="bg-card" />
        <DataStat label="Refunds Awaiting Processing" value={String(pendingRefundCount)} className="bg-card" />
        <DataStat label="Active Disputes" value={String(activeDisputeCount)} className="bg-card" />
        <DataStat label="Disputes Needing Response" value={String(responseNeededDisputeCount)} className="bg-card" />
      </section>

      <SectionCard title="Refund Activity">
        {refundItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refund activity recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refundItems.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell className="font-mono text-xs">{refund.order_id.slice(0, 8)}</TableCell>
                  <TableCell>{formatMoney(refund.amount_cents, billingCurrency)}</TableCell>
                  <TableCell>{refund.reason_key.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <StatusChip label={getRefundStatusLabel(refund.status)} tone={getRefundStatusTone(refund.status)} />
                  </TableCell>
                  <TableCell>{new Date(refund.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Dispute Activity">
        {disputeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment disputes recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputeItems.map((dispute) => (
                <TableRow key={dispute.id}>
                  <TableCell className="font-mono text-xs">{dispute.order_id.slice(0, 8)}</TableCell>
                  <TableCell>{formatMoney(dispute.amount_cents, dispute.currency)}</TableCell>
                  <TableCell>{dispute.reason.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <StatusChip label={getDisputeStatusLabel(dispute.status)} tone={getDisputeStatusTone(dispute.status)} />
                  </TableCell>
                  <TableCell>{dispute.response_due_by ? new Date(dispute.response_due_by).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title="Billing Events">
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
    </section>
  );
}
