"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";

type OrderDetailPanelProps = {
  orderId: string | null;
  onClose: () => void;
};

type OrderDetailResponse = {
  order?: {
    id: string;
    customer_email: string;
    subtotal_cents: number;
    total_cents: number;
    status: string;
    fulfillment_status: string;
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
  error?: string;
};

export function OrderDetailPanel({ orderId, onClose }: OrderDetailPanelProps) {
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
  }, [orderId]);

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

  return (
    <Card className="bg-muted/30">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">Order Detail</CardTitle>
          <CardDescription>Customer, payment, fulfillment, and line-item detail for this order.</CardDescription>
        </div>
        <Button type="button" onClick={onClose} variant="outline" size="sm" className="h-7 text-xs">
          Close
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading order details...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error && payload?.order ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-medium">Order:</span> {payload.order.id}
              </p>
              <p>
                <span className="font-medium">Customer:</span> {payload.order.customer_email}
              </p>
              <p>
                <span className="font-medium">Status:</span> <StatusChip label={payload.order.status} tone={orderTone(payload.order.status)} />
              </p>
              <p>
                <span className="font-medium">Fulfillment:</span>{" "}
                <StatusChip label={formatFulfillmentStatus(payload.order.fulfillment_status)} tone={orderTone(payload.order.fulfillment_status)} />
              </p>
              <p>
                <span className="font-medium">Created:</span> {new Date(payload.order.created_at).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Subtotal:</span> ${(payload.order.subtotal_cents / 100).toFixed(2)}
              </p>
              <p>
                <span className="font-medium">Total:</span> ${(payload.order.total_cents / 100).toFixed(2)}
              </p>
              <p>
                <span className="font-medium">Discount:</span> ${(payload.order.discount_cents / 100).toFixed(2)}
              </p>
              <p>
                <span className="font-medium">Platform fee:</span> ${((feeBreakdown?.platform_fee_cents ?? 0) / 100).toFixed(2)}
              </p>
              <p>
                <span className="font-medium">Net payout:</span> ${((feeBreakdown?.net_payout_cents ?? 0) / 100).toFixed(2)}
              </p>
              <p>
                <span className="font-medium">Fee basis:</span>{" "}
                {feeBreakdown ? `${(feeBreakdown.fee_bps / 100).toFixed(2)}% + $${(feeBreakdown.fee_fixed_cents / 100).toFixed(2)}` : "-"}
              </p>
              <p>
                <span className="font-medium">Billing plan:</span> {feeBreakdown?.plan_key ?? "-"}
              </p>
              <p>
                <span className="font-medium">Promo:</span> {payload.order.promo_code ?? "none"}
              </p>
              <p>
                <span className="font-medium">Carrier:</span> {payload.order.carrier ?? "-"}
              </p>
              <p>
                <span className="font-medium">Tracking:</span> {payload.order.tracking_number ?? "-"}
              </p>
              <p>
                <span className="font-medium">Shipment status:</span> {payload.order.shipment_status ?? "-"}
              </p>
              {payload.order.tracking_url ? (
                <p>
                  <a href={payload.order.tracking_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Open tracking details
                  </a>
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Items</h4>
              <ul className="space-y-2">
                {(payload.items ?? []).map((item) => (
                  <li key={item.id} className="rounded-md border border-border bg-background px-3 py-2">
                    <p className="font-medium">{item.products?.title ?? item.product_id}</p>
                    {item.variant_label ? <p className="text-xs text-muted-foreground">Variant: {item.variant_label}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      Qty {item.quantity} x ${(item.unit_price_cents / 100).toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
