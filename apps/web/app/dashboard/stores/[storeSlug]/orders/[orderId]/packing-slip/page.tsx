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
    .select("id,customer_email,created_at,carrier,tracking_number,tracking_url,fulfillment_status")
    .eq("id", orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<{
      id: string;
      customer_email: string;
      created_at: string;
      carrier: string | null;
      tracking_number: string | null;
      tracking_url: string | null;
      fulfillment_status: string;
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

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-white p-6 text-black print:p-0">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-2xl font-semibold">Packing Slip</h1>
        <p className="text-sm">{bundle.store.name}</p>
        <p className="text-sm">Order: {order.id}</p>
        <p className="text-sm">Placed: {new Date(order.created_at).toLocaleString()}</p>
        <p className="text-sm">Customer: {order.customer_email}</p>
        <p className="text-sm">Fulfillment: {order.fulfillment_status}</p>
      </header>

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

      <section className="pt-4 text-sm">
        <p>Thank you for supporting {bundle.store.name}.</p>
      </section>
    </main>
  );
}
