"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { withReturnTo } from "@/lib/auth/return-to";
import { notify } from "@/lib/feedback/toast";
import { parseApiError } from "@/lib/http/client-error";

type StoreReference = {
  id: string;
  name: string;
  slug: string;
  status?: string;
};

type SavedStoreEntry = {
  id: string;
  stores: StoreReference | StoreReference[] | null;
};

type SavedItemEntry = {
  id: string;
  products: { id: string; title: string } | { id: string; title: string }[] | null;
  product_variants: { id: string; title: string | null } | { id: string; title: string | null }[] | null;
  stores: StoreReference | StoreReference[] | null;
};

type ActiveCartEntry = {
  id: string;
  updated_at: string | null;
  stores: StoreReference | StoreReference[] | null;
};

type RecentOrderEntry = {
  id: string;
  total_cents: number;
  status: string;
  fulfillment_status?: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  created_at: string;
  stores: Pick<StoreReference, "name" | "slug"> | Pick<StoreReference, "name" | "slug">[] | null;
};

type CustomerAccountDashboardPanelsProps = {
  initialSavedStores: SavedStoreEntry[];
  initialSavedItems: SavedItemEntry[];
  carts: ActiveCartEntry[];
  orders: RecentOrderEntry[];
  storefrontLinksBySlug?: Record<
    string,
    {
      storefrontHref: string;
      cartHref: string;
    }
  >;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function CustomerAccountDashboardPanels({
  initialSavedStores,
  initialSavedItems,
  carts,
  orders,
  storefrontLinksBySlug = {}
}: CustomerAccountDashboardPanelsProps) {
  const pathname = usePathname();
  const [savedStores, setSavedStores] = useState(initialSavedStores);
  const [savedItems, setSavedItems] = useState(initialSavedItems);
  const [pendingStoreIds, setPendingStoreIds] = useState<string[]>([]);
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [savedStoresError, setSavedStoresError] = useState<string | null>(null);
  const [savedItemsError, setSavedItemsError] = useState<string | null>(null);
  const [activeCarts, setActiveCarts] = useState(carts);
  const [pendingCartIds, setPendingCartIds] = useState<string[]>([]);
  const [cartsError, setCartsError] = useState<string | null>(null);

  const savedStoreRows = useMemo(
    () =>
      savedStores.map((entry) => ({
        entryId: entry.id,
        store: firstRelation(entry.stores)
      })),
    [savedStores]
  );
  const savedItemRows = useMemo(
    () =>
      savedItems.map((entry) => ({
        entryId: entry.id,
        product: firstRelation(entry.products),
        variant: firstRelation(entry.product_variants),
        store: firstRelation(entry.stores)
      })),
    [savedItems]
  );
  const openOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (order.status === "pending" || order.status === "paid") &&
          (!order.fulfillment_status || order.fulfillment_status !== "delivered")
      ),
    [orders]
  );

  async function removeSavedStore(entryId: string, storeId: string) {
    if (pendingStoreIds.includes(entryId)) {
      return;
    }

    setSavedStoresError(null);
    const snapshot = savedStores;
    setPendingStoreIds((current) => [...current, entryId]);
    setSavedStores((current) => current.filter((entry) => entry.id !== entryId));

    try {
      const response = await fetch(`/api/customer/saved-stores?storeId=${encodeURIComponent(storeId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response, "Unable to remove saved store."));
      }
      notify.success("Saved store removed.");
    } catch (error) {
      setSavedStores(snapshot);
      setSavedStoresError(error instanceof Error ? error.message : "Unable to remove saved store.");
    } finally {
      setPendingStoreIds((current) => current.filter((id) => id !== entryId));
    }
  }

  async function removeSavedItem(entryId: string) {
    if (pendingItemIds.includes(entryId)) {
      return;
    }

    setSavedItemsError(null);
    const snapshot = savedItems;
    setPendingItemIds((current) => [...current, entryId]);
    setSavedItems((current) => current.filter((entry) => entry.id !== entryId));

    try {
      const response = await fetch(`/api/customer/saved-items?id=${encodeURIComponent(entryId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response, "Unable to remove saved item."));
      }
      notify.success("Saved item removed.");
    } catch (error) {
      setSavedItems(snapshot);
      setSavedItemsError(error instanceof Error ? error.message : "Unable to remove saved item.");
    } finally {
      setPendingItemIds((current) => current.filter((id) => id !== entryId));
    }
  }

  async function removeCart(cartId: string) {
    if (pendingCartIds.includes(cartId)) {
      return;
    }

    setCartsError(null);
    const snapshot = activeCarts;
    setPendingCartIds((current) => [...current, cartId]);
    setActiveCarts((current) => current.filter((cart) => cart.id !== cartId));

    try {
      const response = await fetch(`/api/customer/cart?cartId=${encodeURIComponent(cartId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response, "Unable to remove active cart."));
      }
      notify.success("Active cart removed.");
    } catch (error) {
      setActiveCarts(snapshot);
      setCartsError(error instanceof Error ? error.message : "Unable to remove active cart.");
    } finally {
      setPendingCartIds((current) => current.filter((id) => id !== cartId));
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Saved Stores" description="Quick access to your favorited storefronts.">
          <ul className="space-y-2 text-sm">
            {savedStoreRows.length === 0 ? <li className="text-muted-foreground">No saved stores yet.</li> : null}
            {savedStoreRows.map((entry) => {
              const store = entry.store;
              if (!store) {
                return null;
              }
              const isPending = pendingStoreIds.includes(entry.entryId);
              return (
                <li key={entry.entryId} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <Link href={storefrontLinksBySlug[store.slug]?.storefrontHref ?? `/s/${store.slug}`} className="truncate font-medium underline-offset-4 hover:underline">
                    {store.name}
                  </Link>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void removeSavedStore(entry.entryId, store.id)} disabled={isPending}>
                    {isPending ? "Removing..." : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <AppAlert variant="error" message={savedStoresError} className="mt-3" />
        </SectionCard>

        <SectionCard title="Saved Items" description="Products you bookmarked for later.">
          <ul className="space-y-2 text-sm">
            {savedItemRows.length === 0 ? <li className="text-muted-foreground">No saved items yet.</li> : null}
            {savedItemRows.map((entry) => {
              if (!entry.product) {
                return null;
              }
              const isPending = pendingItemIds.includes(entry.entryId);
              return (
                <li key={entry.entryId} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.product.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.variant?.title ? `Variant: ${entry.variant.title}` : "All options"}
                      {entry.store?.name ? ` · ${entry.store.name}` : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void removeSavedItem(entry.entryId)} disabled={isPending}>
                    {isPending ? "Removing..." : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <AppAlert variant="error" message={savedItemsError} className="mt-3" />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Active Carts" description="Jump back into checkout for stores where you still have items in cart.">
          <ul className="space-y-2 text-sm">
            {activeCarts.length === 0 ? <li className="text-muted-foreground">No active carts.</li> : null}
            {activeCarts.map((cart) => {
              const store = firstRelation(cart.stores);
              const isPending = pendingCartIds.includes(cart.id);
              return (
                <li key={cart.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{store?.name ?? "Store"}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {cart.updated_at ? new Date(cart.updated_at).toLocaleString() : "recently"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {store?.slug ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={storefrontLinksBySlug[store.slug]?.cartHref ?? `/cart?store=${encodeURIComponent(store.slug)}`}>Open cart</Link>
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => void removeCart(cart.id)} disabled={isPending}>
                      {isPending ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <AppAlert variant="error" message={cartsError} className="mt-3" />
        </SectionCard>

        <SectionCard title="Orders In Progress" description="Orders that still need fulfillment or delivery updates.">
          <ul className="space-y-2 text-sm">
            {openOrders.length === 0 ? <li className="text-muted-foreground">No active orders in progress.</li> : null}
            {openOrders.map((order) => {
              return (
                <li key={`open-${order.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      ${(order.total_cents / 100).toFixed(2)} · {order.status}
                      {order.fulfillment_status ? ` · ${order.fulfillment_status.replaceAll("_", " ")}` : ""}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={withReturnTo(`/dashboard/customer-orders/${order.id}`, pathname || "/dashboard")}>View</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Recent Orders" description="Your latest purchases across stores.">
          <ul className="space-y-2 text-sm">
            {orders.length === 0 ? <li className="text-muted-foreground">No recent orders.</li> : null}
            {orders.map((order) => {
              const store = firstRelation(order.stores);
              return (
                <li key={order.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      ${(order.total_cents / 100).toFixed(2)} · {order.status} · {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={withReturnTo(`/dashboard/customer-orders/${order.id}`, pathname || "/dashboard")}>View order</Link>
                    </Button>
                    {store?.slug ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={storefrontLinksBySlug[store.slug]?.storefrontHref ?? `/s/${store.slug}`}>{store.name}</Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
      </SectionCard>
    </>
  );
}
