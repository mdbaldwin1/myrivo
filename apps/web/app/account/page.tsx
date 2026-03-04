import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomerAccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: savedStores }, { data: savedItems }, { data: carts }, { data: orders }] = await Promise.all([
    supabase
      .from("customer_saved_stores")
      .select("id,stores(id,name,slug,status)")
      .eq("user_id", user.id),
    supabase
      .from("customer_saved_items")
      .select("id,products(id,title),product_variants(id,title)")
      .eq("user_id", user.id),
    supabase
      .from("customer_carts")
      .select("id,stores(id,name,slug),updated_at")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at,stores(name,slug)")
      .eq("customer_email", user.email ?? "")
      .order("created_at", { ascending: false })
      .limit(15)
  ]);

  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <section className="space-y-4">
        <SectionCard title="Customer Dashboard">
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        </SectionCard>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Saved Stores">
            <ul className="space-y-2 text-sm">
              {(savedStores ?? []).length === 0 ? <li className="text-muted-foreground">No saved stores yet.</li> : null}
              {(savedStores ?? []).map((entry) => {
                const store = Array.isArray(entry.stores) ? entry.stores[0] : entry.stores;
                if (!store) return null;
                return (
                  <li key={entry.id}>
                    <Link href={`/s/${store.slug}`} className="underline-offset-4 hover:underline">
                      {store.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="Saved Items">
            <ul className="space-y-2 text-sm">
              {(savedItems ?? []).length === 0 ? <li className="text-muted-foreground">No saved items yet.</li> : null}
              {(savedItems ?? []).map((entry) => {
                const product = Array.isArray(entry.products) ? entry.products[0] : entry.products;
                const variant = Array.isArray(entry.product_variants) ? entry.product_variants[0] : entry.product_variants;
                return (
                  <li key={entry.id}>
                    <span className="font-medium">{product?.title ?? "Item"}</span>
                    {variant?.title ? <span className="text-muted-foreground"> ({variant.title})</span> : null}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Active Carts">
            <ul className="space-y-2 text-sm">
              {(carts ?? []).length === 0 ? <li className="text-muted-foreground">No active carts.</li> : null}
              {(carts ?? []).map((cart) => {
                const store = Array.isArray(cart.stores) ? cart.stores[0] : cart.stores;
                return (
                  <li key={cart.id}>
                    <span className="font-medium">{store?.name ?? "Store"}</span>
                    {store?.slug ? (
                      <Link href={`/cart?store=${encodeURIComponent(store.slug)}`} className="ml-2 underline-offset-4 hover:underline">
                        Open cart
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="Recent Orders">
            <ul className="space-y-2 text-sm">
              {(orders ?? []).length === 0 ? <li className="text-muted-foreground">No recent orders.</li> : null}
              {(orders ?? []).map((order) => {
                const store = Array.isArray(order.stores) ? order.stores[0] : order.stores;
                return (
                  <li key={order.id}>
                    <span className="font-medium">#{order.id.slice(0, 8)}</span>
                    <span className="ml-2">${(order.total_cents / 100).toFixed(2)}</span>
                    <span className="ml-2 text-muted-foreground">{order.status}</span>
                    {store?.slug ? (
                      <Link href={`/s/${store.slug}`} className="ml-2 underline-offset-4 hover:underline">
                        {store.name}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>
      </section>
    </PageShell>
  );
}
