"use client";

import { useEffect, useState } from "react";
import { OrderActivityTimelinePanel } from "@/components/dashboard/order-activity-timeline-panel";
import { OrderDisputeSummaryPanel } from "@/components/dashboard/order-dispute-summary-panel";
import { OrderRefundRequestPanel } from "@/components/dashboard/order-refund-request-panel";
import { OrderShippingDelayPanel } from "@/components/dashboard/order-shipping-delay-panel";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { OrderDisputeRecord, OrderRefundRecord, OrderShippingDelayRecord } from "@/types/database";
import { OrderFinancialStatus } from "@/lib/orders/refunds";

type OrderDetailPanelProps = {
  orderId: string | null;
  onReschedulePickup?: (orderId: string) => void;
  refreshToken?: number;
};

type OrderDetailResponse = {
  order?: {
    id: string;
    customer_email: string;
    subtotal_cents: number;
    total_cents: number;
    status: OrderFinancialStatus;
    fulfillment_method: "pickup" | "shipping" | null;
    fulfillment_label: string | null;
    fulfillment_status: string;
    pickup_location_id: string | null;
    pickup_location_snapshot_json: Record<string, unknown> | null;
    pickup_window_start_at: string | null;
    pickup_window_end_at: string | null;
    pickup_timezone: string | null;
    fulfilled_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    discount_cents: number;
    promo_code: string | null;
    currency: string;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    shipment_status: string | null;
    last_tracking_sync_at: string | null;
    created_at: string;
    order_fee_breakdowns:
      | {
          platform_fee_cents: number;
          net_payout_cents: number;
          fee_bps: number;
          fee_fixed_cents: number;
          plan_key: string | null;
        }
      | Array<{
          platform_fee_cents: number;
          net_payout_cents: number;
          fee_bps: number;
          fee_fixed_cents: number;
          plan_key: string | null;
        }>
      | null;
  };
  items?: Array<{
    id: string;
    product_id: string;
    product_variant_id: string | null;
    variant_label: string | null;
    variant_snapshot: Record<string, unknown>;
    quantity: number;
    unit_price_cents: number;
    products?: { title?: string } | null;
  }>;
  refunds?: OrderRefundRecord[];
  disputes?: OrderDisputeRecord[];
  shippingDelays?: OrderShippingDelayRecord[];
  timelineEvents?: Array<{
    id: string;
    action: string;
    actor_user_id: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
  error?: string;
};

function buildPickupAddress(snapshot: Record<string, unknown> | null): string | null {
  if (!snapshot) {
    return null;
  }

  const line1 = typeof snapshot.addressLine1 === "string" ? snapshot.addressLine1.trim() : "";
  const line2 = typeof snapshot.addressLine2 === "string" ? snapshot.addressLine2.trim() : "";
  const city = typeof snapshot.city === "string" ? snapshot.city.trim() : "";
  const stateRegion = typeof snapshot.stateRegion === "string" ? snapshot.stateRegion.trim() : "";
  const postalCode = typeof snapshot.postalCode === "string" ? snapshot.postalCode.trim() : "";
  const countryCode = typeof snapshot.countryCode === "string" ? snapshot.countryCode.trim() : "";

  return [line1, line2, [city, stateRegion, postalCode].filter(Boolean).join(", "), countryCode].filter(Boolean).join(" • ") || null;
}

export function OrderDetailPanel({ orderId, onReschedulePickup, refreshToken = 0 }: OrderDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<OrderDetailResponse | null>(null);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let active = true;

    async function loadDetails() {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}`);
      const data = (await response.json()) as OrderDetailResponse;

      if (!active) {
        return;
      }

      setLoading(false);

      if (!response.ok || !data.order) {
        setError(data.error ?? "Unable to load order details.");
        return;
      }

      setPayload(data);
    }

    void loadDetails();

    return () => {
      active = false;
    };
  }, [orderId, refreshToken]);

  if (!orderId) {
    return null;
  }

  function orderTone(status: string) {
    if (status === "paid" || status === "delivered") return "success" as const;
    if (status === "failed" || status === "cancelled") return "danger" as const;
    if (status === "shipped") return "info" as const;
    return "warning" as const;
  }

  function formatFulfillmentStatus(status: string) {
    if (status === "pending_fulfillment") return "Pending fulfillment";
    if (status === "packing") return "Packing";
    if (status === "shipped") return "Shipped";
    if (status === "delivered") return "Delivered";
    return status;
  }

  const feeBreakdown =
    payload?.order
      ? Array.isArray(payload.order.order_fee_breakdowns)
        ? payload.order.order_fee_breakdowns[0]
        : payload.order.order_fee_breakdowns
      : null;
  const pickupAddress = buildPickupAddress(payload?.order?.pickup_location_snapshot_json ?? null);
  const pickupWindow =
    payload?.order?.pickup_window_start_at && payload.order.pickup_window_end_at
      ? `${new Date(payload.order.pickup_window_start_at).toLocaleString()} - ${new Date(payload.order.pickup_window_end_at).toLocaleString()}${
          payload.order.pickup_timezone ? ` (${payload.order.pickup_timezone})` : ""
        }`
      : null;
  const order = payload?.order ?? null;
  const items = payload?.items ?? [];
  const refunds = payload?.refunds ?? [];
  const disputes = payload?.disputes ?? [];
  const shippingDelays = payload?.shippingDelays ?? [];
  const timelineEvents = payload?.timelineEvents ?? [];

  async function refreshOrderDetail() {
    if (!orderId) {
      return;
    }

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/orders/${orderId}`);
    const data = (await response.json()) as OrderDetailResponse;
    setLoading(false);

    if (!response.ok || !data.order) {
      setError(data.error ?? "Unable to load order details.");
      return;
    }

    setPayload(data);
  }

  return (
    <div className="space-y-5">
      {loading ? <p className="text-sm text-muted-foreground">Loading order details...</p> : null}
      <AppAlert variant="error" message={error} />

      {!loading && !error && order ? (
        <div className="space-y-5 text-sm">
          <section className="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-foreground">{order.id}</span>
                  <StatusChip label={order.status} tone={orderTone(order.status)} />
                  <StatusChip label={formatFulfillmentStatus(order.fulfillment_status)} tone={orderTone(order.fulfillment_status)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {order.customer_email} • Created {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              {order.fulfillment_method === "pickup" && order.fulfillment_status !== "delivered" && onReschedulePickup ? (
                <Button type="button" onClick={() => onReschedulePickup(order.id)} variant="outline" size="sm">
                  Reschedule pickup
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Order summary</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background p-4">
                <dl className="grid gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Fulfillment method</dt>
                    <dd className="text-right font-medium">{order.fulfillment_label ?? order.fulfillment_method ?? "-"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Promo code</dt>
                    <dd className="text-right font-medium">{order.promo_code ?? "None"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Carrier</dt>
                    <dd className="text-right font-medium">{order.carrier ?? "-"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Tracking number</dt>
                    <dd className="text-right font-medium">{order.tracking_number ?? "-"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Shipment status</dt>
                    <dd className="text-right font-medium">{order.shipment_status ?? "-"}</dd>
                  </div>
                  {order.tracking_url ? (
                    <div className="pt-1">
                      <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Open tracking details
                      </a>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-4">
                <dl className="grid gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="text-right font-medium">${(order.subtotal_cents / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="text-right font-medium">${(order.discount_cents / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="text-right font-medium">${(order.total_cents / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Platform fee</dt>
                    <dd className="text-right font-medium">${((feeBreakdown?.platform_fee_cents ?? 0) / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Net payout</dt>
                    <dd className="text-right font-medium">${((feeBreakdown?.net_payout_cents ?? 0) / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Fee basis</dt>
                    <dd className="text-right font-medium">
                      {feeBreakdown ? `${(feeBreakdown.fee_bps / 100).toFixed(2)}% + $${(feeBreakdown.fee_fixed_cents / 100).toFixed(2)}` : "-"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Billing plan</dt>
                    <dd className="text-right font-medium">{feeBreakdown?.plan_key ?? "-"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {order.fulfillment_method === "pickup" ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pickup details</h3>
              <div className="rounded-xl border border-border/70 bg-background p-4">
                <dl className="grid gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Pickup location</dt>
                    <dd className="text-right font-medium">{pickupAddress ?? "-"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Pickup window</dt>
                    <dd className="text-right font-medium">{pickupWindow ?? "-"}</dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : null}

          {order.fulfillment_method === "shipping" ? (
            <OrderShippingDelayPanel orderId={order.id} shippingDelays={shippingDelays} refreshOrderDetail={refreshOrderDetail} />
          ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Items</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border/70 bg-background px-4 py-3">
                    <p className="font-medium">{item.products?.title ?? item.product_id}</p>
                    {item.variant_label ? <p className="text-xs text-muted-foreground">Variant: {item.variant_label}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    Qty {item.quantity} x ${(item.unit_price_cents / 100).toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <OrderRefundRequestPanel
            orderId={order.id}
            orderTotalCents={order.total_cents}
            currency={order.currency}
            orderStatus={order.status}
            refunds={refunds}
          />

          <OrderDisputeSummaryPanel disputes={disputes} currency={order.currency} />

          <OrderActivityTimelinePanel events={timelineEvents} />
        </div>
      ) : null}
    </div>
  );
}
