"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Flyout } from "@/components/ui/flyout";
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataStat } from "@/components/ui/data-stat";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderRecord } from "@/types/database";

type OrdersManagerProps = {
  initialOrders: Array<
    Pick<
      OrderRecord,
      | "id"
      | "customer_email"
      | "subtotal_cents"
      | "total_cents"
      | "status"
      | "fulfillment_status"
      | "discount_cents"
      | "promo_code"
      | "carrier"
      | "tracking_number"
      | "tracking_url"
      | "shipment_status"
      | "created_at"
    >
  >;
};

type OrderStatus = OrderRecord["status"];

type OrdersResponse = {
  order?: Pick<
    OrderRecord,
    | "id"
    | "customer_email"
    | "subtotal_cents"
    | "total_cents"
    | "status"
    | "fulfillment_status"
    | "discount_cents"
    | "promo_code"
    | "carrier"
    | "tracking_number"
    | "tracking_url"
    | "shipment_status"
    | "created_at"
  >;
  error?: string;
  message?: string;
};

const statusOptions: OrderStatus[] = ["pending", "paid", "failed", "cancelled"];

function formatFulfillmentStatus(status: OrderRecord["fulfillment_status"]) {
  if (status === "pending_fulfillment") return "Pending fulfillment";
  if (status === "packing") return "Packing";
  if (status === "shipped") return "Shipped";
  return "Delivered";
}

function getFulfillmentOptionsForCurrent(status: OrderRecord["fulfillment_status"]) {
  if (status === "pending_fulfillment") {
    return ["pending_fulfillment", "packing", "shipped", "delivered"] as const;
  }
  if (status === "packing") {
    return ["packing", "shipped", "delivered"] as const;
  }
  if (status === "shipped") {
    return ["shipped", "delivered"] as const;
  }
  return ["delivered"] as const;
}

export function OrdersManager({ initialOrders }: OrdersManagerProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shippingCarrier, setShippingCarrier] = useState("usps");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingInitialCarrier, setShippingInitialCarrier] = useState("usps");
  const [shippingInitialTrackingNumber, setShippingInitialTrackingNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [exporting, setExporting] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => {
    const gross = orders.reduce((sum, order) => sum + order.total_cents, 0);
    return { gross, count: orders.length };
  }, [orders]);

  const fulfillmentStats = useMemo(() => {
    const pending = orders.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
    const packing = orders.filter((order) => order.fulfillment_status === "packing").length;
    const shipped = orders.filter((order) => order.fulfillment_status === "shipped").length;
    return { pending, packing, shipped };
  }, [orders]);

  const visibleOrders = useMemo(
    () => (statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter]
  );
  const isShippingFlyoutDirty =
    Boolean(shippingOrderId) &&
    (shippingCarrier !== shippingInitialCarrier || trackingNumber.trim() !== shippingInitialTrackingNumber.trim());

  function closeShippingFlyout() {
    setShippingOrderId(null);
    setTrackingNumber("");
    setShippingCarrier("usps");
    setShippingError(null);
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setPageError(null);
    setMessage(null);

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status })
    });

    const payload = (await response.json()) as OrdersResponse;

    if (!response.ok || !payload.order) {
      setPageError(payload.error ?? "Unable to update order status.");
      return;
    }

    setOrders((current) => current.map((order) => (order.id === orderId ? payload.order! : order)));
  }

  async function updateFulfillment(orderId: string, fulfillmentStatus: OrderRecord["fulfillment_status"]) {
    setPageError(null);
    setMessage(null);

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, fulfillmentStatus })
    });

    const payload = (await response.json()) as OrdersResponse;

    if (!response.ok || !payload.order) {
      setPageError(payload.error ?? "Unable to update fulfillment status.");
      return;
    }

    setOrders((current) => current.map((order) => (order.id === orderId ? payload.order! : order)));
  }

  async function saveShipmentDetails() {
    if (!shippingOrderId) {
      return;
    }

    setSavingShipment(true);
    setShippingError(null);
    setPageError(null);
    setMessage(null);

    const response = await fetch("/api/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: shippingOrderId,
        carrier: shippingCarrier,
        trackingNumber
      })
    });

    const payload = (await response.json()) as OrdersResponse;
    setSavingShipment(false);

    if (!response.ok || !payload.order) {
      setShippingError(payload.error ?? "Unable to save shipment details.");
      return;
    }

    setOrders((current) => current.map((order) => (order.id === shippingOrderId ? payload.order! : order)));
    setShippingOrderId(null);
    setTrackingNumber("");
    setMessage("Shipment details saved.");
  }

  async function refreshTracking(orderId: string) {
    setPageError(null);
    setMessage(null);
    setSyncingOrderId(orderId);

    const response = await fetch("/api/orders/refresh-tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId })
    });

    const payload = (await response.json()) as OrdersResponse;
    setSyncingOrderId(null);

    if (!response.ok) {
      setPageError(payload.error ?? "Unable to sync tracking.");
      return;
    }

    if (payload.order) {
      setOrders((current) => current.map((order) => (order.id === orderId ? payload.order! : order)));
    }

    if (payload.message) {
      setMessage(payload.message);
    } else {
      setMessage("Tracking synced.");
    }
  }

  async function exportOrdersCsv() {
    setPageError(null);
    setExporting(true);

    const response = await fetch("/api/orders/export");

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "Unable to export orders." }))) as { error?: string };
      setPageError(payload.error ?? "Unable to export orders.");
      setExporting(false);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "orders.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Orders"
        description="Track order status, ship orders, and keep delivery status synced."
        action={
          <RowActions align="start">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/dashboard/orders/pick-list" target="_blank" rel="noreferrer">
                Daily Pick List
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportOrdersCsv()} disabled={exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </RowActions>
        }
      />

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Order Snapshot</CardTitle>
          <CardDescription>Filter and review fulfillment workload and gross order activity.</CardDescription>
          <FormField
            label="Filter status"
            className="block max-w-52"
            labelClassName="text-xs uppercase tracking-wide text-muted-foreground"
            description="Use this to focus on one status without changing order data."
          >
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}>
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <DataStat label="Orders" value={String(totals.count)} />
            <DataStat label="Gross" value={`$${(totals.gross / 100).toFixed(2)}`} />
            <DataStat label="Avg Order" value={totals.count ? `$${(totals.gross / totals.count / 100).toFixed(2)}` : "$0.00"} />
            <DataStat label="To Fulfill" value={String(fulfillmentStats.pending)} />
            <DataStat label="Packing" value={String(fulfillmentStats.packing)} />
            <DataStat label="In Transit" value={String(fulfillmentStats.shipped)} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order List</CardTitle>
          <CardDescription>Update payment and fulfillment status, then manage shipping details per order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeedbackMessage type="error" message={pageError} />
          <FeedbackMessage type="success" message={message} />

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/45">
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-3 text-muted-foreground" colSpan={8}>
                      No orders yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{new Date(order.created_at).toLocaleString()}</TableCell>
                      <TableCell>{order.customer_email}</TableCell>
                      <TableCell>${(order.total_cents / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {order.discount_cents > 0 ? `-$${(order.discount_cents / 100).toFixed(2)}` : "$0.00"}
                        {order.promo_code ? <p className="text-xs text-muted-foreground">{order.promo_code}</p> : null}
                      </TableCell>
                      <TableCell>
                        <Select value={order.status} onChange={(event) => void updateStatus(order.id, event.target.value as OrderStatus)}>
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={order.fulfillment_status}
                          onChange={(event) => void updateFulfillment(order.id, event.target.value as OrderRecord["fulfillment_status"])}
                        >
                          {getFulfillmentOptionsForCurrent(order.fulfillment_status).map((status) => (
                            <option key={status} value={status}>
                              {formatFulfillmentStatus(status)}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        {order.tracking_number ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium">{order.tracking_number}</p>
                            <p className="text-xs text-muted-foreground">{order.shipment_status ?? "unknown"}</p>
                            {order.tracking_url ? (
                              <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                Open tracking
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not shipped</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RowActions align="start">
                          <RowActionButton type="button" onClick={() => setSelectedOrderId(order.id)}>
                            View
                          </RowActionButton>
                          <RowActionButton
                            type="button"
                            onClick={() => {
                              setShippingOrderId(order.id);
                              setShippingError(null);
                              const initialCarrier = order.carrier ?? "usps";
                              const initialTracking = order.tracking_number ?? "";
                              setShippingCarrier(initialCarrier);
                              setTrackingNumber(initialTracking);
                              setShippingInitialCarrier(initialCarrier);
                              setShippingInitialTrackingNumber(initialTracking);
                            }}
                          >
                            {order.tracking_number ? "Edit Ship" : "Ship"}
                          </RowActionButton>
                          <RowActionButton
                            type="button"
                            onClick={() => void refreshTracking(order.id)}
                            disabled={!order.tracking_number || syncingOrderId === order.id}
                          >
                            {syncingOrderId === order.id ? "Syncing..." : "Sync"}
                          </RowActionButton>
                          <RowActionButton type="button" asChild>
                            <Link href={`/dashboard/orders/${order.id}/packing-slip`} target="_blank" rel="noreferrer">
                              Slip
                            </Link>
                          </RowActionButton>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
        </CardContent>
      </Card>

      <Flyout
        open={Boolean(shippingOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            closeShippingFlyout();
          }
        }}
        confirmDiscardOnClose
        isDirty={isShippingFlyoutDirty}
        onDiscardConfirm={closeShippingFlyout}
        title="Mark Order Shipped"
        description="Save carrier and tracking number. Shipment status can auto-sync from provider webhooks."
        footer={({ requestClose }) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Close
            </Button>
            <Button type="submit" form="ship-order-form" disabled={savingShipment || !trackingNumber.trim()}>
              {savingShipment ? "Saving..." : "Save shipment"}
            </Button>
          </div>
        )}
      >
        <form
          id="ship-order-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveShipmentDetails();
          }}
        >
          <FeedbackMessage type="error" message={shippingError} />
          <FormField label="Carrier" description="Carrier name shown alongside tracking details in customer notifications.">
            <Select value={shippingCarrier} onChange={(event) => setShippingCarrier(event.target.value)}>
              <option value="usps">USPS</option>
              <option value="ups">UPS</option>
              <option value="fedex">FedEx</option>
              <option value="dhl">DHL</option>
              <option value="ontrac">OnTrac</option>
              <option value="lasership">LaserShip</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
          <FormField label="Tracking Number" description="Paste the full tracking number exactly as provided by the carrier.">
            <Input required value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="1Z..." />
          </FormField>
        </form>
      </Flyout>
    </section>
  );
}
