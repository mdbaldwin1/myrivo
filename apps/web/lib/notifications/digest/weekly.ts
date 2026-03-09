import { notificationConfig } from "@/lib/notifications/config";
import { resolvePlatformNotificationFromAddress, resolvePlatformNotificationReplyTo } from "@/lib/notifications/sender";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "pending_review" | "active" | "suspended";
};

type StoreMemberRow = {
  user_id: string;
  role: "owner" | "admin" | "staff" | "customer";
  status: "active" | "invited" | "suspended";
};

type UserProfileRow = {
  id: string;
  email: string | null;
  metadata: Record<string, unknown> | null;
};

type WeeklyDigestSummary = {
  storeName: string;
  storeSlug: string;
  windowLabel: string;
  paidOrders: number;
  paidRevenueCents: number;
  pendingFulfillment: number;
  lowStockItems: number;
};

export type WeeklyDigestDispatchResult = {
  storesProcessed: number;
  recipientsEvaluated: number;
  digestsSent: number;
};

function toIsoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getUtcWeekStart(date: Date) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diffToMonday);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function buildWindowLabel(start: Date, end: Date) {
  return `${toIsoDateOnly(start)} to ${toIsoDateOnly(end)}`;
}

export function buildWeeklyDigestBody(summary: WeeklyDigestSummary) {
  return [
    `Weekly digest for ${summary.storeName} (${summary.windowLabel})`,
    `Paid orders: ${summary.paidOrders}`,
    `Paid revenue: $${(summary.paidRevenueCents / 100).toFixed(2)}`,
    `Pending fulfillment: ${summary.pendingFulfillment}`,
    `Low-stock products: ${summary.lowStockItems}`,
    `Open your reports: /dashboard/stores/${summary.storeSlug}/reports/insights`
  ].join("\n");
}

async function loadStoreWeeklySummary(store: StoreRow, sinceIso: string, untilIso: string): Promise<WeeklyDigestSummary> {
  const supabase = createSupabaseAdminClient();
  const [ordersResult, lowStockResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,total_cents,fulfillment_status")
      .eq("store_id", store.id)
      .gte("created_at", sinceIso)
      .lt("created_at", untilIso)
      .returns<Array<{ id: string; status: string; total_cents: number; fulfillment_status: string | null }>>(),
    supabase
      .from("products")
      .select("id")
      .eq("store_id", store.id)
      .eq("status", "active")
      .lte("inventory_qty", notificationConfig.lowStockThreshold)
      .returns<Array<{ id: string }>>()
  ]);

  if (ordersResult.error) {
    throw new Error(ordersResult.error.message);
  }
  if (lowStockResult.error) {
    throw new Error(lowStockResult.error.message);
  }

  const orders = ordersResult.data ?? [];
  const paidOrders = orders.filter((order) => order.status === "paid");
  const paidRevenueCents = paidOrders.reduce((sum, order) => sum + Math.max(0, order.total_cents), 0);
  const pendingFulfillment = orders.filter((order) => order.fulfillment_status === "pending_fulfillment").length;
  const lowStockItems = (lowStockResult.data ?? []).length;

  return {
    storeName: store.name,
    storeSlug: store.slug,
    windowLabel: buildWindowLabel(new Date(sinceIso), new Date(new Date(untilIso).getTime() - 1)),
    paidOrders: paidOrders.length,
    paidRevenueCents,
    pendingFulfillment,
    lowStockItems
  };
}

async function loadStoreRecipients(storeId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("store_memberships")
    .select("user_id,role,status")
    .eq("store_id", storeId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "staff"])
    .returns<StoreMemberRow[]>();

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const userIds = Array.from(new Set((memberships ?? []).map((row) => row.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id,email,metadata")
    .in("id", userIds)
    .returns<UserProfileRow[]>();

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  return (profiles ?? []).filter((profile) => {
    const preferences = resolveAccountNotificationPreferences(profile.metadata);
    return Boolean(profile.email) && preferences.weeklyDigestEmails;
  });
}

export async function dispatchWeeklyDigests(now = new Date()): Promise<WeeklyDigestDispatchResult> {
  const supabase = createSupabaseAdminClient();
  const weekStart = getUtcWeekStart(now);
  const previousWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sinceIso = previousWeekStart.toISOString();
  const untilIso = weekStart.toISOString();
  const weekKey = toIsoDateOnly(previousWeekStart);

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id,slug,name,status")
    .eq("status", "active")
    .returns<StoreRow[]>();

  if (storesError) {
    throw new Error(storesError.message);
  }

  let recipientsEvaluated = 0;
  let digestsSent = 0;

  for (const store of stores ?? []) {
    const [summary, recipients] = await Promise.all([
      loadStoreWeeklySummary(store, sinceIso, untilIso),
      loadStoreRecipients(store.id)
    ]);

    recipientsEvaluated += recipients.length;

    for (const recipient of recipients) {
      const digestBody = buildWeeklyDigestBody(summary);
      const result = await dispatchNotification({
        recipientUserId: recipient.id,
        storeId: store.id,
        eventType: "digest.weekly",
        title: `${store.name} weekly digest`,
        body: `${summary.paidOrders} paid orders, $${(summary.paidRevenueCents / 100).toFixed(2)} revenue, ${summary.lowStockItems} low-stock products`,
        actionUrl: `/dashboard/stores/${store.slug}/reports/insights`,
        channelTargets: ["email"],
        dedupeKey: `digest.weekly:${store.id}:${recipient.id}:${weekKey}`,
        metadata: {
          windowStart: sinceIso,
          windowEnd: untilIso,
          weekKey,
          summary
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: `${store.name} weekly digest`,
          text: digestBody,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      });

      if (!result.skipped) {
        digestsSent += 1;
      }
    }
  }

  return {
    storesProcessed: (stores ?? []).length,
    recipientsEvaluated,
    digestsSent
  };
}
