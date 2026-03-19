"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { Flyout } from "@/components/ui/flyout";
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel";
import { OrderPickupOverridePanel } from "@/components/dashboard/order-pickup-override-panel";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { MoreHorizontal } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/feedback/toast";
import { parseApiError } from "@/lib/http/client-error";
import { buildStoreWorkspacePath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import type { OrderRecord } from "@/types/database";

type OrdersManagerProps = {
  initialOrders: OrderRow[];
};

type OrderFeeBreakdown = {
  platform_fee_cents: number;
  net_payout_cents: number;
  fee_bps: number;
  fee_fixed_cents: number;
  plan_key: string | null;
};

type OrderRow = Pick<
  OrderRecord,
  | "id"
  | "customer_email"
  | "subtotal_cents"
  | "total_cents"
  | "status"
  | "fulfillment_method"
  | "fulfillment_label"
  | "fulfillment_status"
  | "pickup_location_id"
  | "pickup_window_start_at"
  | "pickup_window_end_at"
  | "pickup_timezone"
  | "discount_cents"
  | "promo_code"
  | "carrier"
  | "tracking_number"
  | "tracking_url"
  | "shipment_status"
  | "created_at"
> & {
  order_fee_breakdowns?: OrderFeeBreakdown | OrderFeeBreakdown[] | null;
};

type OrderStatus = OrderRecord["status"];

type OrdersResponse = {
  order?: OrderRow;
  error?: string;
  message?: string;
};

const statusOptions: OrderStatus[] = ["pending", "paid", "failed", "cancelled"];
const fulfillmentStatusOptions: Array<OrderRecord["fulfillment_status"]> = [
  "pending_fulfillment",
  "packing",
  "shipped",
  "delivered"
];

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

function getFeeBreakdown(order: OrderRow): OrderFeeBreakdown | null {
  if (!order.order_fee_breakdowns) {
    return null;
  }
  return Array.isArray(order.order_fee_breakdowns) ? (order.order_fee_breakdowns[0] ?? null) : order.order_fee_breakdowns;
}

export function OrdersManager({ initialOrders }: OrdersManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeStoreSlug = getStoreSlugFromDashboardPathname(pathname);
  const pickListHref = buildStoreWorkspacePath(activeStoreSlug, "/orders/pick-list", "/dashboard/stores");
  const [orders, setOrders] = useState(initialOrders);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shippingCarrier, setShippingCarrier] = useState("usps");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingInitialCarrier, setShippingInitialCarrier] = useState("usps");
  const [shippingInitialTrackingNumber, setShippingInitialTrackingNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<"all" | OrderRecord["fulfillment_status"]>("all");
  const [pickupOverrideOrderId, setPickupOverrideOrderId] = useState<string | null>(null);
  const [pickupOverrideDirty, setPickupOverrideDirty] = useState(false);
  const [pickupOverrideSaving, setPickupOverrideSaving] = useState(false);
  const [pickupOverrideError, setPickupOverrideError] = useState<string | null>(null);
  const [orderDetailRefreshToken, setOrderDetailRefreshToken] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const selectedOrderId = searchParams.get("orderId");

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesFulfillment = fulfillmentFilter === "all" || order.fulfillment_status === fulfillmentFilter;
      return matchesStatus && matchesFulfillment;
    });
  }, [fulfillmentFilter, orders, statusFilter]);
  const isShippingFlyoutDirty =
    Boolean(shippingOrderId) &&
    (shippingCarrier !== shippingInitialCarrier || trackingNumber.trim() !== shippingInitialTrackingNumber.trim());

  function updateOrderDetailUrl(orderId: string | null) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (orderId) {
      nextParams.set("orderId", orderId);
    } else {
      nextParams.delete("orderId");
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  function openOrderDetail(orderId: string) {
    updateOrderDetailUrl(orderId);
  }

  function stopRowClick(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  function closeOrderDetail() {
    updateOrderDetailUrl(null);
  }

  function closeShippingFlyout() {
    setShippingOrderId(null);
    setTrackingNumber("");
    setShippingCarrier("usps");
    setShippingError(null);
  }

  function closePickupOverrideFlyout() {
    setPickupOverrideOrderId(null);
    setPickupOverrideDirty(false);
    setPickupOverrideSaving(false);
    setPickupOverrideError(null);
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setPageError(null);

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
    notify.success("Order status updated.");
  }

  async function updateFulfillment(orderId: string, fulfillmentStatus: OrderRecord["fulfillment_status"]) {
    setPageError(null);

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
    notify.success("Fulfillment status updated.");
  }

  async function saveShipmentDetails() {
    if (!shippingOrderId) {
      return;
    }

    setSavingShipment(true);
    setShippingError(null);
    setPageError(null);

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
    notify.success("Shipment details saved.");
  }

  async function refreshTracking(orderId: string) {
    setPageError(null);
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
      notify.success(payload.message);
    } else {
      notify.success("Tracking synced.");
    }
  }

  async function exportOrdersCsv() {
    setPageError(null);
    setExporting(true);

    const response = await fetch("/api/orders/export");

    if (!response.ok) {
      setPageError(await parseApiError(response, "Unable to export orders."));
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
    notify.success("Orders exported.");
    setExporting(false);
  }

  return (
    <DashboardPageScaffold
      title="Orders"
      description="Track order status, ship orders, and keep delivery status synced."
      className="p-3"
      action={
        <RowActions align="start">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={pickListHref} target="_blank" rel="noreferrer">
              Daily Pick List
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void exportOrdersCsv()} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
          <ContextHelpLink
            href="/docs/catalog-and-orders#order-fulfillment"
            context="orders_manager"
            storeSlug={activeStoreSlug ?? undefined}
            label="Order Help"
          />
        </RowActions>
      }
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Order List</CardTitle>
              <CardDescription>Update payment and fulfillment status, then manage shipping details per order.</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <div className="w-full sm:w-44">
                <FormField label="Order status">
                  <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}>
                    <option value="all">All statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="w-full sm:w-52">
                <FormField label="Fulfillment status">
                  <Select
                    value={fulfillmentFilter}
                    onChange={(event) => setFulfillmentFilter(event.target.value as "all" | OrderRecord["fulfillment_status"])}
                  >
                    <option value="all">All fulfillment</option>
                    {fulfillmentStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatFulfillmentStatus(status)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AppAlert variant="error" message={pageError} />

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/45">
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Net Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-3 text-muted-foreground" colSpan={10}>
                      No orders yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleOrders.map((order) => {
                    const feeBreakdown = getFeeBreakdown(order);
                    return (
                      <TableRow
                        key={order.id}
                        tabIndex={0}
                        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                        onClick={() => openOrderDetail(order.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openOrderDetail(order.id);
                          }
                        }}
                      >
                        <TableCell>{new Date(order.created_at).toLocaleString()}</TableCell>
                        <TableCell>{order.customer_email}</TableCell>
                        <TableCell>${(order.total_cents / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          {order.discount_cents > 0 ? `-$${(order.discount_cents / 100).toFixed(2)}` : "$0.00"}
                          {order.promo_code ? <p className="text-xs text-muted-foreground">{order.promo_code}</p> : null}
                        </TableCell>
                        <TableCell>${((feeBreakdown?.platform_fee_cents ?? 0) / 100).toFixed(2)}</TableCell>
                        <TableCell>${((feeBreakdown?.net_payout_cents ?? 0) / 100).toFixed(2)}</TableCell>
                        <TableCell onClick={stopRowClick}>
                          <Select value={order.status} onChange={(event) => void updateStatus(order.id, event.target.value as OrderStatus)}>
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell onClick={stopRowClick}>
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
                        <TableCell onClick={stopRowClick}>
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
                        <TableCell className="text-right" onClick={stopRowClick}>
                          <RowActions>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label="More order actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openOrderDetail(order.id)}>View</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.fulfillment_method === "pickup" && order.fulfillment_status !== "delivered" ? (
                                  <>
                                    <DropdownMenuItem onClick={() => setPickupOverrideOrderId(order.id)}>Reschedule pickup</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                ) : null}
                                <DropdownMenuItem
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
                                  {order.tracking_number ? "Edit shipment" : "Mark shipped"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void refreshTracking(order.id)}
                                  disabled={!order.tracking_number || syncingOrderId === order.id}
                                >
                                  {syncingOrderId === order.id ? "Syncing tracking..." : "Sync tracking"}
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={buildStoreWorkspacePath(activeStoreSlug, `/orders/${order.id}/packing-slip`, "/dashboard/stores")}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open packing slip
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </RowActions>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Flyout
        open={Boolean(selectedOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            closeOrderDetail();
          }
        }}
        title="Order Detail"
        description="Customer, payment, fulfillment, and line-item detail for this order."
      >
        <OrderDetailPanel
          orderId={selectedOrderId}
          onReschedulePickup={(orderId) => setPickupOverrideOrderId(orderId)}
          refreshToken={orderDetailRefreshToken}
        />
      </Flyout>

      <Flyout
        open={Boolean(pickupOverrideOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            closePickupOverrideFlyout();
          }
        }}
        confirmDiscardOnClose
        isDirty={pickupOverrideDirty}
        onDiscardConfirm={closePickupOverrideFlyout}
        title="Reschedule pickup"
        description="Override a customer-selected pickup slot only when necessary. Saving sends the customer an immediate update."
        footer={({ requestClose }) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Close
            </Button>
            <Button type="submit" form="pickup-override-form" disabled={pickupOverrideSaving}>
              {pickupOverrideSaving ? "Saving..." : "Save pickup override"}
            </Button>
          </div>
        )}
      >
        <AppAlert variant="error" message={pickupOverrideError} />
        {pickupOverrideOrderId ? (
          <OrderPickupOverridePanel
            orderId={pickupOverrideOrderId}
            onDirtyChange={setPickupOverrideDirty}
            onSavingChange={setPickupOverrideSaving}
            onError={setPickupOverrideError}
            onSaved={(order) => {
              setOrders((current) => current.map((entry) => (entry.id === order.id ? order : entry)));
              setOrderDetailRefreshToken((current) => current + 1);
              notify.success("Pickup details updated. Customer notification sent.");
              closePickupOverrideFlyout();
            }}
          />
        ) : null}
      </Flyout>

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
          <AppAlert variant="error" message={shippingError} />
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
    </DashboardPageScaffold>
  );
}
