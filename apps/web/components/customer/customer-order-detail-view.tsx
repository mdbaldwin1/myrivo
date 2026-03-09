"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type StoreSummary = {
  id: string;
  name: string;
  slug: string;
};

type CustomerOrderSummary = {
  id: string;
  store_id: string;
  customer_email: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_note: string | null;
  fulfillment_method: "pickup" | "shipping" | null;
  fulfillment_label: string | null;
  pickup_location_snapshot_json: Record<string, unknown> | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  created_at: string;
  fulfilled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  subtotal_cents: number;
  shipping_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_status: string | null;
  stores: StoreSummary | StoreSummary[] | null;
};

type CustomerOrderItem = {
  id: string;
  quantity: number;
  unit_price_cents: number;
  variant_label: string | null;
  products: { id: string; title: string } | { id: string; title: string }[] | null;
};

type CustomerOrderDetailViewProps = {
  order: CustomerOrderSummary;
  items: CustomerOrderItem[];
  backHref: string;
  storefrontHref?: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase()
  }).format(cents / 100);
}

function formatDateTime(value: string | null, timeZone?: string | null) {
  if (!value) {
    return "Not available";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(value));
}

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

  const lines = [
    [line1, line2].filter(Boolean).join(", "),
    [city, stateRegion, postalCode].filter(Boolean).join(", "),
    countryCode
  ].filter(Boolean);

  return lines.length > 0 ? lines.join(" • ") : null;
}

function statusTone(status: CustomerOrderSummary["status"]) {
  if (status === "paid") {
    return "default";
  }
  if (status === "pending") {
    return "secondary";
  }
  return "outline";
}

export function CustomerOrderDetailView({ order, items, backHref, storefrontHref = null }: CustomerOrderDetailViewProps) {
  const store = firstRelation(order.stores);
  const pickupAddress = buildPickupAddress(order.pickup_location_snapshot_json);
  const orderedAt = formatDateTime(order.created_at);
  const shippedAt = formatDateTime(order.shipped_at);
  const deliveredAt = formatDateTime(order.delivered_at);
  const pickupWindow =
    order.pickup_window_start_at && order.pickup_window_end_at
      ? `${formatDateTime(order.pickup_window_start_at, order.pickup_timezone)} - ${formatDateTime(order.pickup_window_end_at, order.pickup_timezone)}`
      : null;

  return (
    <section className="space-y-4 p-4 lg:p-4">
      <SectionCard title={`Order #${order.id.slice(0, 8)}`} description={`Placed ${orderedAt}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={statusTone(order.status)}>{order.status}</Badge>
            <Badge variant="outline">{order.fulfillment_status.replaceAll("_", " ")}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {store?.slug ? (
              <Button asChild variant="outline" size="sm">
                <Link href={storefrontHref ?? `/s/${store.slug}`}>{store.name}</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href={backHref}>Back</Link>
            </Button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Timeline" description="Latest fulfillment milestones for your order.">
          <ul className="space-y-2 text-sm">
            <li className="rounded-md border border-border/60 px-3 py-2">Ordered · {orderedAt}</li>
            {order.status === "paid" ? <li className="rounded-md border border-border/60 px-3 py-2">Payment confirmed</li> : null}
            {order.fulfillment_status === "packing" || order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered" ? (
              <li className="rounded-md border border-border/60 px-3 py-2">Packing started</li>
            ) : null}
            {order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered" ? (
              <li className="rounded-md border border-border/60 px-3 py-2">Shipped · {shippedAt}</li>
            ) : null}
            {order.fulfillment_status === "delivered" ? (
              <li className="rounded-md border border-border/60 px-3 py-2">Delivered · {deliveredAt}</li>
            ) : null}
          </ul>
        </SectionCard>

        <SectionCard title="Fulfillment" description="Shipping or pickup details for this order.">
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Method:</span> {order.fulfillment_label || order.fulfillment_method || "Not specified"}
            </p>
            {order.fulfillment_method === "shipping" ? (
              <>
                {order.carrier ? (
                  <p>
                    <span className="font-medium">Carrier:</span> {order.carrier}
                  </p>
                ) : null}
                {order.tracking_number ? (
                  <p>
                    <span className="font-medium">Tracking #:</span> {order.tracking_number}
                  </p>
                ) : null}
                {order.tracking_url ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={order.tracking_url} target="_blank" rel="noreferrer">
                      Track shipment
                    </a>
                  </Button>
                ) : null}
              </>
            ) : null}
            {order.fulfillment_method === "pickup" ? (
              <>
                {pickupAddress ? (
                  <p>
                    <span className="font-medium">Pickup location:</span> {pickupAddress}
                  </p>
                ) : null}
                {pickupWindow ? (
                  <p>
                    <span className="font-medium">Pickup window:</span> {pickupWindow}
                  </p>
                ) : null}
              </>
            ) : null}
            {order.customer_note ? (
              <p>
                <span className="font-medium">Order note:</span> {order.customer_note}
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Total" description="Final order totals including shipping and discounts.">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatCurrency(order.subtotal_cents, order.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Shipping / pickup fee</dt>
              <dd>{formatCurrency(order.shipping_fee_cents, order.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Discounts</dt>
              <dd>-{formatCurrency(order.discount_cents, order.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatCurrency(order.total_cents, order.currency)}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Items" description="Products included in this order.">
        <ul className="space-y-2 text-sm">
          {items.map((item) => {
            const product = firstRelation(item.products);
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{product?.title || "Product"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Qty {item.quantity}
                    {item.variant_label ? ` · ${item.variant_label}` : ""}
                  </p>
                </div>
                <p className="shrink-0">{formatCurrency(item.unit_price_cents * item.quantity, order.currency)}</p>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </section>
  );
}
