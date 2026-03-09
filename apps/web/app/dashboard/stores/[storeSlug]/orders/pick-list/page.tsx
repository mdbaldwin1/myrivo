import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
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

export default async function StoreWorkspacePickListPage({ params }: PageProps) {
  const { storeSlug } = await params;
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

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,customer_email,created_at,fulfillment_status")
    .eq("store_id", bundle.store.id)
    .in("fulfillment_status", ["pending_fulfillment", "packing"])
    .order("created_at", { ascending: true });

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  const orderIds = (orders ?? []).map((order) => order.id);

  const { data: items, error: itemsError } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("order_id,quantity,variant_label,products(title)")
        .in("order_id", orderIds)
    : { data: [], error: null };

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const counts = new Map<string, number>();
  const lineItems = new Map<string, number>();

  for (const item of items ?? []) {
    const key = `${getProductTitle(item.products)}${item.variant_label ? ` (${item.variant_label})` : ""}`;
    counts.set(key, (counts.get(key) ?? 0) + item.quantity);
    lineItems.set(item.order_id, (lineItems.get(item.order_id) ?? 0) + item.quantity);
  }

  const sortedCounts = [...counts.entries()].sort((left, right) => right[1] - left[1]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 bg-white p-6 text-black print:p-0">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-2xl font-semibold">Daily Pick List</h1>
        <p className="text-sm">{bundle.store.name}</p>
        <p className="text-sm">Generated: {new Date().toLocaleString()}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Consolidated Quantities</h2>
        {sortedCounts.length === 0 ? (
          <p className="text-sm">No orders currently pending fulfillment.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sortedCounts.map(([label, quantity]) => (
              <li key={label} className="flex items-center justify-between border-b pb-1">
                <span>{label}</span>
                <span className="font-medium">Qty {quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Orders In Queue</h2>
        <ul className="space-y-2 text-sm">
          {(orders ?? []).map((order) => (
            <li key={order.id} className="rounded border p-3">
              <p className="font-medium">{order.id}</p>
              <p>{order.customer_email}</p>
              <p>
                {new Date(order.created_at).toLocaleString()} • {order.fulfillment_status} • Qty {lineItems.get(order.id) ?? 0}
              </p>
              <Link
                className="text-primary underline"
                href={`/dashboard/stores/${bundle.store.slug}/orders/${order.id}/packing-slip`}
                target="_blank"
                rel="noreferrer"
              >
                Print packing slip
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
