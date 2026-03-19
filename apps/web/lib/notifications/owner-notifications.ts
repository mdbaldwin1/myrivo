import { notificationConfig, getNotificationDedupeBucketKey } from "@/lib/notifications/config";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { resolvePlatformNotificationFromAddress, resolvePlatformNotificationReplyTo } from "@/lib/notifications/sender";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoreRecipientRow = {
  user_id: string;
  role: "owner" | "admin" | "staff" | "customer";
  status: "active" | "invited" | "suspended";
};

type StoreOwnerRow = {
  owner_user_id: string;
};

type OrderNotificationRow = {
  id: string;
  store_id: string;
  store_slug: string | null;
  customer_email: string;
  fulfillment_method: "pickup" | "shipping" | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
};

type TeamInviteAcceptedInput = {
  storeId: string;
  storeSlug?: string | null;
  acceptedInviteId: string;
  acceptedByUserId: string;
  acceptedEmail: string;
  role: string;
};

type InventoryLevelAlertInput = {
  storeId: string;
  storeSlug?: string | null;
  productId: string;
  productTitle: string;
  inventoryQty: number;
  previousInventoryQty: number | null;
  productStatus: "draft" | "active" | "archived";
  variantId?: string | null;
  variantTitle?: string | null;
};

type SystemSetupWarningInput = {
  storeId: string;
  storeSlug: string;
  missingSteps: string[];
  source: string;
  actorUserId?: string;
};

type ReviewCreatedNotificationInput = {
  storeId: string;
  storeSlug?: string | null;
  reviewId: string;
  productId?: string | null;
  rating: number;
  reviewerName?: string | null;
  holdForModeration: boolean;
};

async function resolveStoreSlugById(storeId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("stores").select("slug").eq("id", storeId).maybeSingle<{ slug: string | null }>();
  if (error) {
    throw new Error(error.message);
  }
  return data?.slug?.trim() || null;
}

type ReviewModeratedCustomerInput = {
  recipientUserId: string;
  storeId: string;
  reviewId: string;
  status: "published" | "rejected";
  reason?: string | null;
};

type ReviewRespondedCustomerInput = {
  recipientUserId: string;
  storeId: string;
  reviewId: string;
};

type StoreSubmittedForReviewOwnerInput = {
  storeId: string;
  storeSlug: string;
  submittedByUserId: string;
};

type StoreSubmittedForReviewAdminInput = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  submittedByUserId: string;
};

type StoreStatusChangedOwnerInput = {
  storeId: string;
  storeSlug: string;
  action: "approve" | "request_changes" | "reject" | "suspend" | "restore" | "remove" | "go_live" | "go_offline";
  reason?: string | null;
  actorUserId?: string;
};

async function resolveStoreRecipientUserIds(storeId: string, excludedUserIds: string[] = []) {
  const excluded = new Set(excludedUserIds);
  const supabase = createSupabaseAdminClient();
  const [{ data: memberships, error: membershipsError }, { data: store, error: storeError }] = await Promise.all([
    supabase
      .from("store_memberships")
      .select("user_id,role,status")
      .eq("store_id", storeId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "staff"])
      .returns<StoreRecipientRow[]>(),
    supabase
      .from("stores")
      .select("owner_user_id")
      .eq("id", storeId)
      .maybeSingle<StoreOwnerRow>()
  ]);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }
  if (storeError) {
    throw new Error(storeError.message);
  }

  const recipients = new Set<string>();
  for (const member of memberships ?? []) {
    if (!excluded.has(member.user_id)) {
      recipients.add(member.user_id);
    }
  }
  if (store?.owner_user_id && !excluded.has(store.owner_user_id)) {
    recipients.add(store.owner_user_id);
  }

  return Array.from(recipients);
}

async function resolvePlatformAdminRecipientUserIds(excludedUserIds: string[] = []) {
  const excluded = new Set(excludedUserIds);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("user_profiles").select("id").eq("global_role", "admin").returns<Array<{ id: string }>>();
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((entry) => entry.id).filter((id) => !excluded.has(id));
}

async function loadOrderNotificationRow(orderId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id,store_id,customer_email,fulfillment_method,pickup_window_start_at,pickup_window_end_at,stores!inner(slug)")
    .eq("id", orderId)
    .maybeSingle<
      Omit<OrderNotificationRow, "store_slug"> & {
        stores: { slug: string | null } | { slug: string | null }[] | null;
      }
    >();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  const store = Array.isArray(data.stores) ? data.stores[0] : data.stores;
  return {
    id: data.id,
    store_id: data.store_id,
    store_slug: store?.slug ?? null,
    customer_email: data.customer_email,
    fulfillment_method: data.fulfillment_method,
    pickup_window_start_at: data.pickup_window_start_at,
    pickup_window_end_at: data.pickup_window_end_at
  } satisfies OrderNotificationRow;
}

function buildStoreOrdersActionUrl(storeSlug: string | null, orderId: string) {
  const basePath = storeSlug ? `/dashboard/stores/${storeSlug}/orders` : "/dashboard/stores";
  return `${basePath}?orderId=${encodeURIComponent(orderId)}`;
}

function buildTeamMemberActionUrl(storeSlug: string | null, memberUserId: string) {
  const basePath = storeSlug ? `/dashboard/stores/${storeSlug}/store-settings/team` : "/dashboard/stores";
  return `${basePath}?memberUserId=${encodeURIComponent(memberUserId)}`;
}

function buildAdminStoreGovernanceActionUrl(storeId: string) {
  return `/dashboard/admin/stores?storeId=${encodeURIComponent(storeId)}`;
}

export async function notifyOwnersOrderCreated(orderId: string) {
  const order = await loadOrderNotificationRow(orderId);
  if (!order) {
    return;
  }
  const storeOrdersPath = buildStoreOrdersActionUrl(order.store_slug, order.id);

  const recipients = await resolveStoreRecipientUserIds(order.store_id);
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: order.store_id,
        eventType: "order.created.owner",
        title: "New order received",
        body: `Order ${order.id.slice(0, 8)} was placed by ${order.customer_email}.`,
        actionUrl: storeOrdersPath,
        channelTargets: ["in_app"],
        dedupeKey: `order.created.owner:${order.id}:${recipientUserId}`,
        metadata: {
          orderId: order.id
        }
      })
    )
  );

  if (order.fulfillment_method === "pickup") {
    await Promise.all(
      recipients.map((recipientUserId) =>
        dispatchNotification({
          recipientUserId,
          storeId: order.store_id,
          eventType: "order.pickup.updated",
          title: "Pickup order scheduled",
          body:
            order.pickup_window_start_at && order.pickup_window_end_at
              ? `Order ${order.id.slice(0, 8)} has a pickup window scheduled.`
              : `Order ${order.id.slice(0, 8)} is marked for pickup.`,
          actionUrl: storeOrdersPath,
          channelTargets: ["in_app"],
          dedupeKey: `order.pickup.updated:${order.id}:${recipientUserId}`,
          metadata: {
            orderId: order.id,
            pickupWindowStartAt: order.pickup_window_start_at,
            pickupWindowEndAt: order.pickup_window_end_at
          }
        })
      )
    );
  }
}

export async function notifyOwnersOrderFulfillmentStatus(orderId: string, status: "shipped" | "delivered") {
  const order = await loadOrderNotificationRow(orderId);
  if (!order) {
    return;
  }
  const storeOrdersPath = buildStoreOrdersActionUrl(order.store_slug, order.id);

  const recipients = await resolveStoreRecipientUserIds(order.store_id);
  const eventType = status === "shipped" ? "order.fulfillment.shipped" : "order.fulfillment.delivered";
  const title = status === "shipped" ? "Order marked shipped" : "Order marked delivered";
  const body = `Order ${order.id.slice(0, 8)} is now ${status}.`;
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: order.store_id,
        eventType,
        title,
        body,
        actionUrl: storeOrdersPath,
        channelTargets: ["in_app"],
        dedupeKey: `${eventType}:${order.id}:${recipientUserId}`,
        metadata: {
          orderId: order.id,
          fulfillmentStatus: status
        }
      })
    )
  );
}

export async function notifyOwnersInventoryLevel(input: InventoryLevelAlertInput) {
  if (input.productStatus === "archived") {
    return;
  }

  const threshold = Math.max(1, notificationConfig.lowStockThreshold);
  const currentQty = Math.max(0, Math.trunc(input.inventoryQty));
  const previousQty = input.previousInventoryQty === null ? null : Math.max(0, Math.trunc(input.previousInventoryQty));

  let eventType: "inventory.low_stock" | "inventory.out_of_stock" | null = null;
  if (currentQty <= 0 && (previousQty === null || previousQty > 0)) {
    eventType = "inventory.out_of_stock";
  } else if (currentQty > 0 && currentQty <= threshold && (previousQty === null || previousQty > threshold || previousQty <= 0)) {
    eventType = "inventory.low_stock";
  }

  if (!eventType) {
    return;
  }

  const inventoryLabel = input.variantTitle?.trim() ? `${input.productTitle} (${input.variantTitle.trim()})` : input.productTitle;
  const dedupeSubjectKey = input.variantId ?? input.productId;
  const transitionKey = `${previousQty ?? "null"}->${currentQty}`;
  const title = eventType === "inventory.out_of_stock" ? "Item is out of stock" : "Inventory running low";
  const body =
    eventType === "inventory.out_of_stock"
      ? `${inventoryLabel} just hit 0 in inventory.`
      : `${inventoryLabel} has ${currentQty} units left (threshold: ${threshold}).`;

  const storeSlug = input.storeSlug?.trim() || (await resolveStoreSlugById(input.storeId));
  const catalogPath = storeSlug ? `/dashboard/stores/${storeSlug}/catalog?productId=${encodeURIComponent(input.productId)}` : "/dashboard/stores";
  const recipients = await resolveStoreRecipientUserIds(input.storeId);
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType,
        title,
        body,
        actionUrl: catalogPath,
        dedupeKey: `${eventType}:${input.storeId}:${dedupeSubjectKey}:${transitionKey}:${recipientUserId}`,
        metadata: {
          productId: input.productId,
          productTitle: input.productTitle,
          variantId: input.variantId ?? null,
          variantTitle: input.variantTitle ?? null,
          inventoryQty: currentQty,
          previousInventoryQty: previousQty,
          threshold,
          transitionKey
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: title,
          text: `${body}\n\nOpen catalog: ${catalogPath}`,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      })
    )
  );
}

export async function notifyOwnersSystemSetupWarning(input: SystemSetupWarningInput) {
  if (input.missingSteps.length === 0) {
    return;
  }

  const bucket = getNotificationDedupeBucketKey();
  const missing = input.missingSteps.map((step) => step.trim()).filter(Boolean);
  if (missing.length === 0) {
    return;
  }

  const missingSignature = missing.join("|").toLowerCase();
  const recipients = await resolveStoreRecipientUserIds(input.storeId, input.actorUserId ? [input.actorUserId] : []);
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType: "system.setup.warning",
        title: "Store launch blocked by setup",
        body: `Complete setup steps before launch: ${missing.join(", ")}.`,
        actionUrl: `/dashboard/stores/${input.storeSlug}/store-settings/general`,
        dedupeKey: `system.setup.warning:${input.storeId}:${missingSignature}:${bucket}:${recipientUserId}`,
        metadata: {
          missingSteps: missing,
          source: input.source,
          dedupeBucket: bucket
        }
      })
    )
  );
}

export async function notifyOwnersTeamInviteAccepted(input: TeamInviteAcceptedInput) {
  const storeSlug = input.storeSlug?.trim() || (await resolveStoreSlugById(input.storeId));
  const teamPath = buildTeamMemberActionUrl(storeSlug, input.acceptedByUserId);
  const recipients = await resolveStoreRecipientUserIds(input.storeId, [input.acceptedByUserId]);
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType: "team.invite.accepted",
        title: "Team member joined",
        body: `${input.acceptedEmail} accepted an invite as ${input.role}.`,
        actionUrl: teamPath,
        channelTargets: ["in_app"],
        dedupeKey: `team.invite.accepted:${input.acceptedInviteId}:${recipientUserId}`,
        metadata: {
          inviteId: input.acceptedInviteId,
          acceptedByUserId: input.acceptedByUserId,
          role: input.role
        }
      })
    )
  );
}

export async function notifyOwnersReviewCreated(input: ReviewCreatedNotificationInput) {
  const storeSlug = input.storeSlug?.trim() || (await resolveStoreSlugById(input.storeId));
  const reviewsPath = storeSlug ? `/dashboard/stores/${storeSlug}/reviews?reviewId=${input.reviewId}` : "/dashboard/stores";
  const recipients = await resolveStoreRecipientUserIds(input.storeId);
  const reviewerLabel = input.reviewerName?.trim() || "A customer";
  const reviewScopeLabel = input.productId ? "product review" : "store review";

  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType: "review.created.owner",
        title: "New review submitted",
        body: `${reviewerLabel} submitted a ${input.rating}-star ${reviewScopeLabel}.`,
        actionUrl: reviewsPath,
        dedupeKey: `review.created.owner:${input.reviewId}:${recipientUserId}`,
        metadata: {
          reviewId: input.reviewId,
          productId: input.productId ?? null,
          rating: input.rating,
          holdForModeration: input.holdForModeration
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: "New review submitted",
          text: `${reviewerLabel} submitted a ${input.rating}-star ${reviewScopeLabel}. Open ${reviewsPath} to review details.`,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      })
    )
  );

  if (input.rating > 2) {
    return;
  }

  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType: "review.low_rating.owner",
        title: "Low rating review received",
        body: `${reviewerLabel} submitted a ${input.rating}-star ${reviewScopeLabel}.`,
        actionUrl: reviewsPath,
        dedupeKey: `review.low_rating.owner:${input.reviewId}:${recipientUserId}`,
        metadata: {
          reviewId: input.reviewId,
          productId: input.productId ?? null,
          rating: input.rating
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: "Low rating review received",
          text: `${reviewerLabel} submitted a ${input.rating}-star ${reviewScopeLabel}. Open ${reviewsPath}.`,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      })
    )
  );
}

export async function notifyCustomerReviewModerated(input: ReviewModeratedCustomerInput) {
  await dispatchNotification({
    recipientUserId: input.recipientUserId,
    storeId: input.storeId,
    eventType: "review.moderated.customer",
    title: input.status === "published" ? "Your review is live" : "Your review was not approved",
    body:
      input.status === "published"
        ? "Your review is now published."
        : input.reason?.trim()
          ? `Your review was not approved: ${input.reason.trim()}`
          : "Your review was not approved.",
    actionUrl: "/notifications",
    dedupeKey: `review.moderated.customer:${input.reviewId}:${input.status}:${input.recipientUserId}`,
    channelTargets: ["in_app"]
  });
}

export async function notifyCustomerReviewResponded(input: ReviewRespondedCustomerInput) {
  await dispatchNotification({
    recipientUserId: input.recipientUserId,
    storeId: input.storeId,
    eventType: "review.responded.customer",
    title: "Store replied to your review",
    body: "A store owner posted a response to your review.",
    actionUrl: "/notifications",
    dedupeKey: `review.responded.customer:${input.reviewId}:${input.recipientUserId}`,
    channelTargets: ["in_app"]
  });
}

export async function notifyOwnersStoreSubmittedForReview(input: StoreSubmittedForReviewOwnerInput) {
  const recipients = await resolveStoreRecipientUserIds(input.storeId, [input.submittedByUserId]);
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType: "store.review.submitted.owner",
        title: "Store submitted for review",
        body: "Your store has been submitted and is waiting for platform approval.",
        actionUrl: `/dashboard/stores/${input.storeSlug}/store-settings/general`,
        dedupeKey: `store.review.submitted.owner:${input.storeId}:${recipientUserId}`,
        metadata: {
          submittedByUserId: input.submittedByUserId
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: "Store submitted for review",
          text: `Your store has been submitted and is waiting for platform approval. Open /dashboard/stores/${input.storeSlug}/store-settings/general for status updates.`,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      })
    )
  );
}

export async function notifyPlatformAdminsStoreSubmittedForReview(input: StoreSubmittedForReviewAdminInput) {
  const recipients = await resolvePlatformAdminRecipientUserIds([input.submittedByUserId]);
  const governancePath = buildAdminStoreGovernanceActionUrl(input.storeId);
  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType: "store.review.submitted.admin",
        title: "Store approval required",
        body: `${input.storeName} (${input.storeSlug}) was submitted for review.`,
        actionUrl: governancePath,
        dedupeKey: `store.review.submitted.admin:${input.storeId}:${recipientUserId}`,
        metadata: {
          storeSlug: input.storeSlug,
          storeName: input.storeName,
          submittedByUserId: input.submittedByUserId
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: "Store approval required",
          text: `${input.storeName} (${input.storeSlug}) was submitted for review. Open ${governancePath} to approve or reject.`,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      })
    )
  );
}

export async function notifyOwnersStoreStatusChanged(input: StoreStatusChangedOwnerInput) {
  const recipients = await resolveStoreRecipientUserIds(input.storeId, input.actorUserId ? [input.actorUserId] : []);
  const reasonText = input.reason?.trim() ? ` Reason: ${input.reason.trim()}` : "";

  let eventType: "store.review.approved.owner" | "store.review.rejected.owner" | "store.review.suspended.owner";
  let title: string;
  let body: string;
  if (input.action === "approve") {
    eventType = "store.review.approved.owner";
    title = "Store approved";
    body = "Your store has been approved and is now live.";
  } else if (input.action === "request_changes") {
    eventType = "store.review.rejected.owner";
    title = "Changes requested";
    body = `The platform review team requested changes before your store can go live.${reasonText}`;
  } else if (input.action === "reject") {
    eventType = "store.review.rejected.owner";
    title = "Store application rejected";
    body = `Your go-live application was rejected.${reasonText}`;
  } else if (input.action === "go_live") {
    eventType = "store.review.approved.owner";
    title = "Store is live again";
    body = "Your storefront is public again.";
  } else if (input.action === "go_offline") {
    eventType = "store.review.suspended.owner";
    title = "Store taken offline";
    body = "Your storefront is now offline.";
  } else if (input.action === "restore") {
    eventType = "store.review.approved.owner";
    title = "Store restored";
    body = "Your storefront is available again.";
  } else if (input.action === "remove") {
    eventType = "store.review.suspended.owner";
    title = "Store removed";
    body = `Your storefront was removed from the platform.${reasonText}`;
  } else {
    eventType = "store.review.suspended.owner";
    title = "Store suspended";
    body = `Your store has been suspended.${reasonText}`;
  }

  await Promise.all(
    recipients.map((recipientUserId) =>
      dispatchNotification({
        recipientUserId,
        storeId: input.storeId,
        eventType,
        title,
        body,
        actionUrl: `/dashboard/stores/${input.storeSlug}/store-settings/general`,
        dedupeKey: `${eventType}:${input.storeId}:${recipientUserId}:${input.action}`,
        metadata: {
          action: input.action,
          reason: input.reason?.trim() || null
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          subject: title,
          text: `${body}\n\nOpen /dashboard/stores/${input.storeSlug}/store-settings/general for details.`,
          replyTo: resolvePlatformNotificationReplyTo()
        }
      })
    )
  );
}
