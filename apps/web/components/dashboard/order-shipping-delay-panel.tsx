"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import {
  getShippingDelayCustomerPathLabel,
  getShippingDelayInitialStatus,
  getShippingDelayReasonLabel,
  getShippingDelayStatusLabel,
  ORDER_SHIPPING_DELAY_CUSTOMER_PATH_OPTIONS,
  ORDER_SHIPPING_DELAY_REASON_OPTIONS,
  ORDER_SHIPPING_DELAY_STATUS_OPTIONS,
} from "@/lib/orders/shipping-delays";
import type { OrderShippingDelayRecord, OrderShippingDelayStatus } from "@/types/database";

type OrderShippingDelayPanelProps = {
  orderId: string;
  shippingDelays: OrderShippingDelayRecord[];
  refreshOrderDetail: () => Promise<void>;
};

function getStatusTone(status: OrderShippingDelayStatus) {
  switch (status) {
    case "delay_approved":
    case "resolved":
      return "success" as const;
    case "delay_rejected":
    case "cancel_requested":
    case "refund_required":
      return "danger" as const;
    case "awaiting_customer_response":
      return "warning" as const;
    default:
      return "info" as const;
  }
}

export function OrderShippingDelayPanel({ orderId, shippingDelays, refreshOrderDetail }: OrderShippingDelayPanelProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonKey, setReasonKey] = useState<OrderShippingDelayRecord["reason_key"]>("inventory_shortfall");
  const [customerPath, setCustomerPath] = useState<OrderShippingDelayRecord["customer_path"]>("notify_only");
  const [originalShipPromise, setOriginalShipPromise] = useState("");
  const [revisedShipDate, setRevisedShipDate] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const activeDelay = useMemo(
    () => shippingDelays.find((delay) => delay.status !== "resolved" && !delay.resolved_at) ?? null,
    [shippingDelays]
  );

  function syncFormFromDelay(nextDelay: OrderShippingDelayRecord | null) {
    if (!nextDelay) {
      setReasonKey("inventory_shortfall");
      setCustomerPath("notify_only");
      setOriginalShipPromise("");
      setRevisedShipDate("");
      setInternalNote("");
      return;
    }

    setReasonKey(nextDelay.reason_key);
    setCustomerPath(nextDelay.customer_path);
    setOriginalShipPromise(nextDelay.original_ship_promise ?? "");
    setRevisedShipDate(nextDelay.revised_ship_date ?? "");
    setInternalNote(nextDelay.internal_note ?? "");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      syncFormFromDelay(activeDelay);
    }
  }

  async function submitDelay() {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/orders/shipping-delays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        reasonKey,
        customerPath,
        originalShipPromise: originalShipPromise.trim() || undefined,
        revisedShipDate: revisedShipDate || undefined,
        internalNote: internalNote.trim() || undefined,
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save shipping delay.");
      return;
    }

    setOpen(false);
    syncFormFromDelay(null);
    await refreshOrderDetail();
  }

  async function updateDelayStatus(status: OrderShippingDelayStatus) {
    if (!activeDelay) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/orders/shipping-delays/${activeDelay.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: status === "resolved" ? "resolve" : "set_status",
        status,
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to update shipping delay.");
      return;
    }

    await refreshOrderDetail();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shipping delay</h3>
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
          <DialogPrimitive.Trigger asChild>
            <Button type="button" variant="outline" size="sm">
              {activeDelay ? "Update delay" : "Record delay"}
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:transition-none motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none" />
            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[calc(100vh-2rem)] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white p-6 shadow-lg">
            <DialogPrimitive.Title className="shrink-0 text-lg font-semibold text-foreground">
              {activeDelay ? "Update shipping delay" : "Record shipping delay"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 shrink-0 text-sm text-muted-foreground">
                Capture the revised ship expectation and the customer path so the order stays operationally clear.
            </DialogPrimitive.Description>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-4 pt-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Delay reason</span>
                <Select value={reasonKey} onChange={(event) => setReasonKey(event.target.value as OrderShippingDelayRecord["reason_key"])}>
                  {ORDER_SHIPPING_DELAY_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Customer path</span>
                <Select value={customerPath} onChange={(event) => setCustomerPath(event.target.value as OrderShippingDelayRecord["customer_path"])}>
                  {ORDER_SHIPPING_DELAY_CUSTOMER_PATH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ORDER_SHIPPING_DELAY_CUSTOMER_PATH_OPTIONS.find((option) => option.value === customerPath)?.description}
                </p>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Original ship promise</span>
                <Input
                  value={originalShipPromise}
                  onChange={(event) => setOriginalShipPromise(event.target.value)}
                  placeholder="Example: Ships by March 18"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Revised ship date</span>
                <Input value={revisedShipDate} onChange={(event) => setRevisedShipDate(event.target.value)} type="date" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Internal note</span>
                <Textarea
                  value={internalNote}
                  onChange={(event) => setInternalNote(event.target.value)}
                  placeholder="Capture what changed operationally and what staff should know next."
                />
              </label>

              <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                Initial status after save: <span className="font-medium text-foreground">{getShippingDelayStatusLabel(getShippingDelayInitialStatus(customerPath))}</span>
              </div>
            </div>

              <AppAlert variant="error" message={error} />

            <div className="mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitDelay()} disabled={saving}>
                Save delay
              </Button>
            </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>

      <AppAlert variant="error" message={error} />

      {activeDelay ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-background p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={getShippingDelayStatusLabel(activeDelay.status)} tone={getStatusTone(activeDelay.status)} />
            <span className="text-xs text-muted-foreground">Reason: {getShippingDelayReasonLabel(activeDelay.reason_key)}</span>
            <span className="text-xs text-muted-foreground">Customer path: {getShippingDelayCustomerPathLabel(activeDelay.customer_path)}</span>
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Original promise</dt>
              <dd className="text-right font-medium">{activeDelay.original_ship_promise ?? "-"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Revised ship date</dt>
              <dd className="text-right font-medium">{activeDelay.revised_ship_date ?? "-"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Internal note</dt>
              <dd className="max-w-[24rem] text-right font-medium">{activeDelay.internal_note ?? "-"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {ORDER_SHIPPING_DELAY_STATUS_OPTIONS.filter((option) => option.value !== activeDelay.status).map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={option.value === "resolved" ? "default" : "outline"}
                size="sm"
                onClick={() => void updateDelayStatus(option.value)}
                disabled={saving}
              >
                Mark {option.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          No active shipping delay is recorded for this order.
        </div>
      )}

      {shippingDelays.length > 1 ? (
        <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Previous delay cases</p>
          <ul className="mt-3 space-y-2 text-sm">
            {shippingDelays
              .filter((delay) => activeDelay?.id !== delay.id)
              .map((delay) => (
                <li key={delay.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
                  <span className="font-medium">{getShippingDelayStatusLabel(delay.status)}</span>
                  <span className="text-xs text-muted-foreground">
                    {getShippingDelayReasonLabel(delay.reason_key)} · {delay.revised_ship_date ?? "no revised date"} · {new Date(delay.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
