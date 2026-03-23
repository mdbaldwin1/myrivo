"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { getDisputeStatusLabel } from "@/lib/orders/refunds";
import { OrderDisputeRecord } from "@/types/database";

type OrderDisputeSummaryPanelProps = {
  disputes: OrderDisputeRecord[];
  currency: string;
};

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);
}

function getDisputeTone(status: OrderDisputeRecord["status"]) {
  if (status === "won" || status === "prevented" || status === "warning_closed") return "success" as const;
  if (status === "lost") return "danger" as const;
  if (status === "needs_response" || status === "warning_needs_response") return "warning" as const;
  return "info" as const;
}

export function OrderDisputeSummaryPanel({ disputes, currency }: OrderDisputeSummaryPanelProps) {
  if (disputes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-background px-4 py-4">
      <div className="space-y-1">
        <h4 className="font-medium">Disputes</h4>
        <p className="text-xs text-muted-foreground">Chargeback and dispute activity synced from Stripe appears here.</p>
      </div>

      <ul className="space-y-2">
        {disputes.map((dispute) => (
          <li key={dispute.id} className="rounded-md border border-border/70 bg-muted/10 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="font-medium">
                  {formatMoney(dispute.amount_cents, currency)} · {dispute.reason.replaceAll("_", " ")}
                </p>
                <p className="text-xs text-muted-foreground">Opened {new Date(dispute.created_at).toLocaleString()}</p>
              </div>
              <StatusChip label={getDisputeStatusLabel(dispute.status)} tone={getDisputeTone(dispute.status)} />
            </div>
            {dispute.response_due_by ? (
              <p className="mt-2 text-xs text-muted-foreground">Response due by {new Date(dispute.response_due_by).toLocaleString()}</p>
            ) : null}
            {dispute.is_charge_refundable ? (
              <p className="mt-1 text-xs text-muted-foreground">Stripe still marks the related charge as refundable.</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
