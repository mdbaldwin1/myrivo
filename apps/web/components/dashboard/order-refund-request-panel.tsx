"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import { getRefundReasonLabel, getRefundStatusLabel, getRemainingRefundableCents, MERCHANT_REFUND_REASONS, OrderFinancialStatus } from "@/lib/orders/refunds";
import { OrderRefundRecord } from "@/types/database";

type OrderRefundRequestPanelProps = {
  orderId: string;
  orderTotalCents: number;
  currency: string;
  orderStatus: OrderFinancialStatus;
  refunds: OrderRefundRecord[];
};

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);
}

function getRefundStatusTone(status: OrderRefundRecord["status"]) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed" || status === "cancelled") return "danger" as const;
  if (status === "processing") return "info" as const;
  return "warning" as const;
}

export function OrderRefundRequestPanel({ orderId, orderTotalCents, currency, orderStatus, refunds }: OrderRefundRequestPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amountInput, setAmountInput] = useState("");
  const [reasonKey, setReasonKey] = useState<(typeof MERCHANT_REFUND_REASONS)[number]>("customer_request");
  const [reasonNote, setReasonNote] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [processingRefundId, setProcessingRefundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OrderRefundRecord[]>(refunds);

  useEffect(() => {
    setItems(refunds);
  }, [refunds]);

  const remainingRefundableCents = useMemo(() => getRemainingRefundableCents(orderTotalCents, items), [items, orderTotalCents]);
  const parsedAmountCents = Math.round(Number(amountInput || "0") * 100);
  const previewAmountCents = mode === "full" ? remainingRefundableCents : Math.max(0, parsedAmountCents);
  const canRequestRefund = orderStatus === "paid" && remainingRefundableCents > 0;

  function renderReasonLabel(reasonKey: string) {
    return MERCHANT_REFUND_REASONS.includes(reasonKey as (typeof MERCHANT_REFUND_REASONS)[number])
      ? getRefundReasonLabel(reasonKey as (typeof MERCHANT_REFUND_REASONS)[number])
      : reasonKey;
  }

  async function submit() {
    if (!canRequestRefund) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/orders/refunds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderId,
        mode,
        amountCents: mode === "partial" ? parsedAmountCents : undefined,
        reasonKey,
        reasonNote: reasonNote.trim() || undefined,
        customerMessage: customerMessage.trim() || undefined
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      refund?: OrderRefundRecord;
      error?: string;
    };

    setSaving(false);

    if (!response.ok || !payload.refund) {
      setError(payload.error ?? "Unable to request refund.");
      return;
    }

    setItems((current) => [payload.refund!, ...current]);
    setMode("full");
    setAmountInput("");
    setReasonKey("customer_request");
    setReasonNote("");
    setCustomerMessage("");
    setOpen(false);
  }

  async function processRefund(refundId: string) {
    setProcessingRefundId(refundId);
    setError(null);

    const response = await fetch(`/api/orders/refunds/${refundId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "process" })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      refund?: OrderRefundRecord | null;
      error?: string;
    };

    setProcessingRefundId(null);

    if (!response.ok || !payload.refund) {
      setError(payload.error ?? "Unable to process refund.");
      return;
    }

    setItems((current) => current.map((refund) => (refund.id === payload.refund!.id ? payload.refund! : refund)));
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-background px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="font-medium">Refunds</h4>
          <p className="text-xs text-muted-foreground">
            Remaining refundable amount: {formatMoney(remainingRefundableCents, currency)}
          </p>
        </div>
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={!canRequestRefund}>
              Request refund
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:transition-none motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none" />
            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[calc(100vh-2rem)] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white p-6 shadow-lg">
              <DialogPrimitive.Title className="shrink-0 text-lg font-semibold text-foreground">Request refund</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 shrink-0 text-sm text-muted-foreground">
                Capture the amount, reason, and customer-facing note now. Stripe execution and customer notification will follow in the next step of the workflow.
              </DialogPrimitive.Description>

              <form
                className="mt-5 flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
                  <AppAlert variant="error" message={error} />

                  <FormField label="Refund type" description="Use full when the remaining balance should be refunded entirely.">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={mode === "full"}
                        className={`rounded-md border px-3 py-3 text-left text-sm ${mode === "full" ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                        onClick={() => setMode("full")}
                      >
                        <p className="font-medium">Full refund</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatMoney(remainingRefundableCents, currency)}</p>
                      </button>
                      <button
                        type="button"
                        aria-pressed={mode === "partial"}
                        className={`rounded-md border px-3 py-3 text-left text-sm ${mode === "partial" ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                        onClick={() => setMode("partial")}
                      >
                        <p className="font-medium">Partial refund</p>
                        <p className="mt-1 text-xs text-muted-foreground">Choose a specific amount.</p>
                      </button>
                    </div>
                  </FormField>

                  {mode === "partial" ? (
                    <FormField
                      label="Refund amount"
                      description={`Maximum available right now: ${formatMoney(remainingRefundableCents, currency)}.`}
                    >
                      <Input
                        className="focus-visible:ring-inset focus-visible:ring-offset-0"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amountInput}
                        onChange={(event) => setAmountInput(event.target.value)}
                      />
                    </FormField>
                  ) : null}

                  <FormField label="Reason" description="This is required for internal tracking and the order timeline.">
                  <Select
                    className="focus:ring-inset focus:ring-offset-0"
                    value={reasonKey}
                    onChange={(event) => setReasonKey(event.target.value as (typeof MERCHANT_REFUND_REASONS)[number])}
                  >
                    {MERCHANT_REFUND_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {getRefundReasonLabel(reason)}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Internal note"
                    description="Optional context for the team. Use this for operational detail that should stay internal."
                  >
                  <Textarea
                    className="focus-visible:ring-inset focus-visible:ring-offset-0"
                    value={reasonNote}
                    onChange={(event) => setReasonNote(event.target.value)}
                    placeholder="For example: one item arrived damaged, customer kept the remaining items."
                    />
                  </FormField>

                  <FormField
                    label="Customer note"
                    description="Optional message to carry into the customer refund communication in the next step."
                  >
                  <Textarea
                    className="focus-visible:ring-inset focus-visible:ring-offset-0"
                    value={customerMessage}
                    onChange={(event) => setCustomerMessage(event.target.value)}
                    placeholder="For example: We’re refunding the damaged candle and will follow up if you need anything else."
                    />
                  </FormField>

                  <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3 text-sm">
                    <p className="font-medium">Refund preview</p>
                    <p className="mt-1 text-muted-foreground">{formatMoney(previewAmountCents, currency)} will be recorded against this order.</p>
                  </div>
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-white pt-4">
                  <DialogPrimitive.Close asChild>
                    <Button type="button" variant="outline" disabled={saving}>
                      Cancel
                    </Button>
                  </DialogPrimitive.Close>
                  <Button
                    type="submit"
                    disabled={
                      saving ||
                      !canRequestRefund ||
                      previewAmountCents <= 0 ||
                      (mode === "partial" && previewAmountCents > remainingRefundableCents)
                    }
                  >
                    {saving ? "Saving..." : "Save refund request"}
                  </Button>
                </div>
              </form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>

      {!canRequestRefund ? (
        <p className="text-xs text-muted-foreground">
          {orderStatus !== "paid"
            ? "Only paid orders can enter the refund workflow."
            : "This order has no refundable balance remaining."}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((refund) => (
            <li key={refund.id} className="rounded-md border border-border/70 bg-muted/10 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {formatMoney(refund.amount_cents, currency)} · {renderReasonLabel(refund.reason_key)}
                    </p>
                  <p className="text-xs text-muted-foreground">Requested {new Date(refund.created_at).toLocaleString()}</p>
                </div>
                <StatusChip label={getRefundStatusLabel(refund.status)} tone={getRefundStatusTone(refund.status)} />
              </div>
              {refund.reason_note ? <p className="mt-2 text-xs text-muted-foreground">Internal note: {refund.reason_note}</p> : null}
              {refund.customer_message ? <p className="mt-1 text-xs text-muted-foreground">Customer note: {refund.customer_message}</p> : null}
              {refund.status === "requested" || refund.status === "failed" ? (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant={refund.status === "failed" ? "outline" : "default"}
                    disabled={processingRefundId === refund.id}
                    onClick={() => void processRefund(refund.id)}
                  >
                    {processingRefundId === refund.id ? "Processing..." : refund.status === "failed" ? "Retry refund" : "Issue refund in Stripe"}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No refund activity has been recorded for this order yet.</p>
      )}
    </div>
  );
}
