import { getPendingStoreInvitesByEmail } from "@/lib/account/pending-store-invites";
import { hasGlobalRole } from "@/lib/auth/roles";
import type { DashboardHomeData, DashboardHomePriorityItem } from "@/lib/dashboard/home/dashboard-home-types";
import type { GlobalUserRole } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type DashboardHomeInput = {
  supabase: SupabaseClient;
  adminSupabase?: SupabaseClient;
  userId: string;
  userEmail: string | null;
  role: GlobalUserRole;
};

type CartRow = {
  id: string;
  store_id: string;
  updated_at: string | null;
  stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

type CartItemRow = {
  cart_id: string;
  quantity: number;
  unit_price_snapshot_cents: number;
};

type OrderRow = {
  id: string;
  total_cents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  tracking_url: string | null;
  created_at: string;
  stores: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type SavedStoreRow = {
  id: string;
  store_id: string;
  stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

type SavedItemRow = {
  id: string;
  product_id: string | null;
  products: { title: string } | { title: string }[] | null;
  product_variants: { title: string | null } | { title: string | null }[] | null;
  stores: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  action_url: string | null;
  severity: "info" | "warning" | "critical";
  status: "pending" | "sent" | "failed" | "dismissed" | "read";
  read_at: string | null;
  created_at: string;
};

type MembershipRow = {
  store_id: string;
  role: "owner" | "admin" | "staff" | "customer";
  stores: { id: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" } | null;
};

type ManagedStoreOrderRow = {
  id: string;
  store_id: string;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type BuildDashboardHomePrioritiesInput = {
  unreadCount: number;
  activeCarts: DashboardHomeData["carts"];
  openOrders: DashboardHomeData["orders"]["open"];
  pendingInvites: DashboardHomeData["pendingInvites"];
  managedStoreCount: number;
  pendingFulfillmentCount: number;
  pendingReviewCount: number;
  platformPendingApprovals: number;
};

export function buildDashboardHomePriorities(input: BuildDashboardHomePrioritiesInput): DashboardHomePriorityItem[] {
  const items: DashboardHomePriorityItem[] = [];

  if (input.pendingInvites.length > 0) {
    const firstInvite = input.pendingInvites[0];
    if (firstInvite) {
      items.push({
        id: "pending-store-invites",
        title: "Team invite waiting",
        detail: `${firstInvite.storeName} invited you as ${firstInvite.role}.`,
        href: "/dashboard",
        severity: "high"
      });
    }
  }

  if (input.platformPendingApprovals > 0) {
    items.push({
      id: "platform-approvals",
      title: "Store approvals waiting",
      detail: `${input.platformPendingApprovals} store(s) are pending platform review.`,
      href: "/dashboard/admin",
      severity: "critical"
    });
  }

  if (input.pendingFulfillmentCount > 0) {
    items.push({
      id: "workspace-fulfillment",
      title: "Orders need fulfillment",
      detail: `${input.pendingFulfillmentCount} order(s) are pending fulfillment across your stores.`,
      href: "/dashboard/stores",
      severity: "high"
    });
  }

  if (input.pendingReviewCount > 0) {
    items.push({
      id: "workspace-review",
      title: "Your stores pending review",
      detail: `${input.pendingReviewCount} store(s) are waiting for platform approval.`,
      href: "/dashboard/stores",
      severity: "high"
    });
  }

  if (input.activeCarts.length > 0) {
    const firstCart = input.activeCarts[0];
    if (!firstCart) {
      return items.slice(0, 6);
    }
    items.push({
      id: "active-cart",
      title: "Continue checkout",
      detail: `${firstCart.storeName} cart has ${firstCart.itemCount} item(s).`,
      href: `/cart?store=${encodeURIComponent(firstCart.storeSlug)}`,
      severity: "medium"
    });
  }

  const shippedWithTracking = input.openOrders.find((order) => order.fulfillmentStatus === "shipped" && order.trackingUrl);
  if (shippedWithTracking) {
    items.push({
      id: "track-order",
      title: "Track your shipment",
      detail: `Order ${shippedWithTracking.id.slice(0, 8)} is shipped and ready to track.`,
      href: `/dashboard/customer-orders/${shippedWithTracking.id}`,
      severity: "medium"
    });
  }

  if (input.unreadCount > 0) {
    items.push({
      id: "notifications",
      title: "Unread notifications",
      detail: `${input.unreadCount} unread notification(s) in your inbox.`,
      href: "/notifications?returnTo=/dashboard",
      severity: "medium"
    });
  }

  if (items.length === 0 && input.managedStoreCount > 0) {
    items.push({
      id: "workspace-checkin",
      title: "Review your stores",
      detail: "No urgent items right now. Check your Store Hub for opportunities.",
      href: "/dashboard/stores",
      severity: "medium"
    });
  }

  if (items.length === 0) {
    items.push({
      id: "browse-stores",
      title: "Browse saved stores",
      detail: "No urgent items. Explore your saved stores and products.",
      href: "/dashboard",
      severity: "medium"
    });
  }

  return items.slice(0, 6);
}

export async function getDashboardHomeData(input: DashboardHomeInput): Promise<DashboardHomeData> {
  const normalizedEmail = (input.userEmail ?? "").trim().toLowerCase();
  const inviteSupabase = input.adminSupabase ?? input.supabase;

  const [
    { data: carts, error: cartsError },
    { data: savedStores, error: savedStoresError },
    { data: savedItems, error: savedItemsError },
    { data: notifications, error: notificationsError },
    { count: unreadCount, error: unreadError },
    { data: memberships, error: membershipsError },
    { count: platformPendingApprovals, error: platformPendingApprovalsError },
    { data: orders, error: ordersError }
  ] = await Promise.all([
    input.supabase
      .from("customer_carts")
      .select("id,store_id,updated_at,stores(id,name,slug)")
      .eq("user_id", input.userId)
      .eq("status", "active")
      .returns<CartRow[]>(),
    input.supabase
      .from("customer_saved_stores")
      .select("id,store_id,stores(id,name,slug)")
      .eq("user_id", input.userId)
      .returns<SavedStoreRow[]>(),
    input.supabase
      .from("customer_saved_items")
      .select("id,product_id,products(title),product_variants(title),stores(name,slug)")
      .eq("user_id", input.userId)
      .returns<SavedItemRow[]>(),
    input.supabase
      .from("notifications")
      .select("id,title,body,action_url,severity,status,read_at,created_at")
      .eq("recipient_user_id", input.userId)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<NotificationRow[]>(),
    input.supabase
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("recipient_user_id", input.userId)
      .is("read_at", null)
      .neq("status", "dismissed"),
    input.supabase
      .from("store_memberships")
      .select("store_id,role,stores!inner(id,slug,status)")
      .eq("user_id", input.userId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "staff"])
      .returns<MembershipRow[]>(),
    hasGlobalRole(input.role, "support")
      ? input.supabase.from("stores").select("id", { head: true, count: "exact" }).eq("status", "pending_review")
      : Promise.resolve({ count: 0, error: null }),
    normalizedEmail
      ? input.supabase
          .from("orders")
          .select("id,total_cents,status,fulfillment_status,tracking_url,created_at,stores(name,slug)")
          .ilike("customer_email", normalizedEmail)
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<OrderRow[]>()
      : Promise.resolve({ data: [], error: null })
  ]);

  const firstError = [
    cartsError,
    savedStoresError,
    savedItemsError,
    notificationsError,
    unreadError,
    membershipsError,
    platformPendingApprovalsError,
    ordersError
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const cartIds = (carts ?? []).map((cart) => cart.id);
  const { data: cartItems, error: cartItemsError } = cartIds.length
    ? await input.supabase
        .from("customer_cart_items")
        .select("cart_id,quantity,unit_price_snapshot_cents")
        .in("cart_id", cartIds)
        .returns<CartItemRow[]>()
    : { data: [] as CartItemRow[], error: null };

  if (cartItemsError) {
    throw new Error(cartItemsError.message);
  }

  const managedStoreIds = Array.from(new Set((memberships ?? []).map((m) => m.store_id)));
  const { data: managedStoreOrders, error: managedStoreOrdersError } = managedStoreIds.length
    ? await input.supabase
        .from("orders")
        .select("id,store_id")
        .in("store_id", managedStoreIds)
        .in("fulfillment_status", ["pending_fulfillment", "packing"])
        .returns<ManagedStoreOrderRow[]>()
    : { data: [] as ManagedStoreOrderRow[], error: null };

  if (managedStoreOrdersError) {
    throw new Error(managedStoreOrdersError.message);
  }

  const cartItemsByCart = new Map<string, CartItemRow[]>();
  for (const item of cartItems ?? []) {
    const current = cartItemsByCart.get(item.cart_id) ?? [];
    current.push(item);
    cartItemsByCart.set(item.cart_id, current);
  }

  const normalizedCarts = (carts ?? [])
    .map((cart) => {
      const store = firstRelation(cart.stores);
      if (!store) {
        return null;
      }
      const items = cartItemsByCart.get(cart.id) ?? [];
      return {
        id: cart.id,
        updatedAt: cart.updated_at,
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotalCents: items.reduce((sum, item) => sum + item.quantity * item.unit_price_snapshot_cents, 0)
      };
    })
    .filter((cart): cart is NonNullable<typeof cart> => Boolean(cart));

  const normalizedOrders = (orders ?? []).map((order) => {
    const store = firstRelation(order.stores);
    return {
      id: order.id,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      totalCents: order.total_cents,
      status: order.status,
      fulfillmentStatus: order.fulfillment_status,
      trackingUrl: order.tracking_url,
      createdAt: order.created_at
    };
  });

  const openOrders = normalizedOrders.filter(
    (order) => (order.status === "paid" || order.status === "pending") && order.fulfillmentStatus !== "delivered"
  );

  const managedStores = (memberships ?? [])
    .map((membership) => firstRelation(membership.stores))
    .filter((store): store is NonNullable<typeof store> => Boolean(store));

  const pendingReviewCount = managedStores.filter((store) => store.status === "pending_review").length;

  const workspacePulse = managedStores.length
    ? {
        managedStoreCount: managedStores.length,
        pendingFulfillmentCount: (managedStoreOrders ?? []).length,
        pendingReviewCount,
        primaryStoreSlug: managedStores[0]?.slug ?? null
      }
    : null;

  const platformPulse = hasGlobalRole(input.role, "support")
    ? {
        pendingApprovalCount: platformPendingApprovals ?? 0
      }
    : null;

  const normalizedPendingInvites = await getPendingStoreInvitesByEmail(inviteSupabase, input.userEmail);

  const priorities = buildDashboardHomePriorities({
    unreadCount: unreadCount ?? 0,
    activeCarts: normalizedCarts,
    openOrders,
    pendingInvites: normalizedPendingInvites,
    managedStoreCount: managedStores.length,
    pendingFulfillmentCount: workspacePulse?.pendingFulfillmentCount ?? 0,
    pendingReviewCount,
    platformPendingApprovals: platformPulse?.pendingApprovalCount ?? 0
  });

  return {
    role: input.role,
    summary: {
      unreadNotificationCount: unreadCount ?? 0,
      openOrdersCount: openOrders.length,
      activeCartCount: normalizedCarts.length,
      managedStoreCount: managedStores.length
    },
    priorities,
    carts: normalizedCarts,
    orders: {
      open: openOrders,
      recent: normalizedOrders
    },
    savedStores: (savedStores ?? [])
      .map((entry) => {
        const store = firstRelation(entry.stores);
        if (!store) {
          return null;
        }
        return {
          id: entry.id,
          storeId: entry.store_id,
          storeName: store.name,
          storeSlug: store.slug
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    savedItems: (savedItems ?? []).map((entry) => ({
      id: entry.id,
      storeName: firstRelation(entry.stores)?.name ?? null,
      storeSlug: firstRelation(entry.stores)?.slug ?? null,
      productId: entry.product_id,
      productTitle: firstRelation(entry.products)?.title ?? null,
      variantTitle: firstRelation(entry.product_variants)?.title ?? null
    })),
    notifications: {
      unreadCount: unreadCount ?? 0,
      recent: (notifications ?? []).map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        actionUrl: entry.action_url,
        severity: entry.severity,
        status: entry.status,
        readAt: entry.read_at,
        createdAt: entry.created_at
      }))
    },
    pendingInvites: normalizedPendingInvites,
    workspacePulse,
    platformPulse
  };
}
