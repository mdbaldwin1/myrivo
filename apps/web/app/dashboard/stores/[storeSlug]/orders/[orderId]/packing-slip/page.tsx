import { notFound, redirect } from "next/navigation";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ storeSlug: string; orderId: string }>;
};

export const dynamic = "force-dynamic";

function getProductTitle(products: { title?: string } | Array<{ title?: string }> | null | undefined): string {
  if (!products) {
    return "Product";
  }

  if (Array.isArray(products)) {
    return products[0]?.title ?? "Product";
  }

  return products.title ?? "Product";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPickupWindow(startAt: string | null, endAt: string | null, timezone: string | null): string | null {
  if (!startAt || !endAt) {
    return null;
  }

  const tz = timezone || "America/New_York";
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short", timeZone: tz };
  const start = new Date(startAt).toLocaleString("en-US", options);
  const end = new Date(endAt).toLocaleString("en-US", { timeStyle: "short", timeZone: tz });
  return `${start} – ${end}`;
}

function formatAddress(json: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (json.recipientName) lines.push(String(json.recipientName));
  if (json.name) lines.push(String(json.name));
  if (json.addressLine1) lines.push(String(json.addressLine1));
  if (json.addressLine2) lines.push(String(json.addressLine2));
  const cityLine = [json.city, json.stateRegion, json.postalCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

export default async function StoreWorkspacePackingSlipPage({ params }: PageProps) {
  const { storeSlug, orderId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug);

  if (!bundle) {
    redirect("/dashboard/stores");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,customer_email,customer_first_name,customer_last_name,created_at,carrier,tracking_number,tracking_url,fulfillment_status,fulfillment_method,fulfillment_label,shipping_address_json,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone"
    )
    .eq("id", orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{
      id: string;
      customer_email: string;
      customer_first_name: string | null;
      customer_last_name: string | null;
      created_at: string;
      carrier: string | null;
      tracking_number: string | null;
      tracking_url: string | null;
      fulfillment_status: string;
      fulfillment_method: "pickup" | "shipping" | null;
      fulfillment_label: string | null;
      shipping_address_json: Record<string, unknown> | null;
      pickup_location_snapshot_json: Record<string, unknown> | null;
      pickup_window_start_at: string | null;
      pickup_window_end_at: string | null;
      pickup_timezone: string | null;
    }>();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    notFound();
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id,quantity,variant_label,products(title)")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const customerName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ");
  const isPickup = order.fulfillment_method === "pickup";
  const isShipping = order.fulfillment_method === "shipping";
  const fulfillmentLabel = order.fulfillment_label || (isPickup ? "Porch Pickup" : isShipping ? "Shipping" : "—");
  const shippingAddress = isRecord(order.shipping_address_json) ? formatAddress(order.shipping_address_json) : [];
  const pickupLocation = isRecord(order.pickup_location_snapshot_json) ? formatAddress(order.pickup_location_snapshot_json) : [];
  const pickupWindow = formatPickupWindow(order.pickup_window_start_at, order.pickup_window_end_at, order.pickup_timezone);

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-white p-6 text-black print:p-0">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-2xl font-semibold">Packing Slip</h1>
        <p className="text-sm">{bundle.store.name}</p>
        <p className="text-sm">Order: {order.id}</p>
        <p className="text-sm">Placed: {new Date(order.created_at).toLocaleString()}</p>
        <p className="text-sm">Customer: {customerName || order.customer_email}</p>
        {customerName ? <p className="text-sm text-gray-500">{order.customer_email}</p> : null}
        <p className="text-sm">
          Fulfillment: {fulfillmentLabel} · {order.fulfillment_status}
        </p>
      </header>

      {isShipping && shippingAddress.length > 0 ? (
        <section className="space-y-1 border-b pb-4 text-sm">
          <h2 className="font-semibold">Ship To</h2>
          {shippingAddress.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </section>
      ) : null}

      {isPickup ? (
        <section className="space-y-1 border-b pb-4 text-sm">
          <h2 className="font-semibold">Pickup Details</h2>
          {pickupLocation.length > 0 ? (
            <div>
              <p className="font-medium">Location</p>
              {pickupLocation.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : null}
          {pickupWindow ? (
            <div className="mt-1">
              <p className="font-medium">Window</p>
              <p>{pickupWindow}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Items</h2>
        <ul className="space-y-1 text-sm">
          {(items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between border-b pb-1">
              <span>
                {getProductTitle(item.products)}
                {item.variant_label ? ` (${item.variant_label})` : ""}
              </span>
              <span>Qty {item.quantity}</span>
            </li>
          ))}
        </ul>
      </section>

      {isShipping ? (
        <section className="space-y-1 text-sm">
          <h2 className="font-semibold">Shipment</h2>
          <p>Carrier: {order.carrier ?? "TBD"}</p>
          <p>Tracking: {order.tracking_number ?? "Not assigned"}</p>
          {order.tracking_url ? (
            <p>
              Link:{" "}
              <a className="underline" href={order.tracking_url}>
                {order.tracking_url}
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="pt-4 text-sm">
        <p>Thank you for supporting {bundle.store.name}.</p>
      </section>
    </main>
  );
}
