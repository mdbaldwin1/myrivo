import { getExternalAppUrl, getServerEnv } from "@/lib/env";
import { createEmailStudioDocumentFromSection, type EmailStudioDocument, type EmailStudioTemplateId } from "@/lib/email-studio/model";
import { renderEmailStudioTemplate } from "@/lib/email-studio/render";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import {
  getShippingDelayCustomerPathLabel,
  getShippingDelayReasonLabel,
  type OrderShippingDelayCustomerPath,
  type OrderShippingDelayReasonKey
} from "@/lib/orders/shipping-delays";
import { notifyOwnersOrderCreated, notifyOwnersOrderFulfillmentStatus } from "@/lib/notifications/owner-notifications";
import { getDisputeStatusLabel, getRefundReasonLabel, type DisputeStatus, type MerchantRefundReason } from "@/lib/orders/refunds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderEmailItem = {
  title: string;
  variantLabel: string | null;
  quantity: number;
  unitPriceCents: number;
};

type OrderEmailContext = {
  orderId: string;
  storeId: string;
  storeName: string;
  storeSlug: string | null;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  primaryDomain: string | null;
  primaryDomainEmailSenderEnabled: boolean;
  primaryDomainEmailStatus: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
  ownerEmails: string[];
  supportEmail: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  promoCode: string | null;
  createdAt: string;
  trackingUrl: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  fulfillmentMethod: "pickup" | "shipping" | null;
  pickupLocationSnapshot: Record<string, unknown> | null;
  pickupWindowStartAt: string | null;
  pickupWindowEndAt: string | null;
  pickupTimezone: string | null;
  items: OrderEmailItem[];
  emailDocument: EmailStudioDocument;
};

type PickupSummaryInput = Pick<
  OrderEmailContext,
  "fulfillmentMethod" | "pickupLocationSnapshot" | "pickupWindowStartAt" | "pickupWindowEndAt" | "pickupTimezone"
>;

const CUSTOMER_CONFIRMATION_ACTION = "email_order_confirmation_sent";
const CUSTOMER_ORDER_FAILED_ACTION = "email_order_failed_sent";
const CUSTOMER_ORDER_CANCELLED_ACTION = "email_order_cancelled_sent";
const CUSTOMER_PICKUP_UPDATED_ACTION = "email_order_pickup_updated_sent";
const CUSTOMER_SHIPPING_DELAY_ACTION = "email_order_shipping_delay_sent";
const CUSTOMER_REFUND_ISSUED_ACTION = "email_order_refund_issued_sent";
const CUSTOMER_DISPUTE_OPENED_ACTION = "email_order_dispute_opened_sent";
const CUSTOMER_DISPUTE_RESOLVED_ACTION = "email_order_dispute_resolved_sent";
const OWNER_NEW_ORDER_ACTION = "email_owner_new_order_sent";
const ORDER_SHIPPED_ACTION = "email_order_shipped_sent";
const ORDER_SHIPPED_WITH_TRACKING_ACTION = "email_order_shipped_with_tracking_sent";
const ORDER_DELIVERED_ACTION = "email_order_delivered_sent";

export function resolveShippingEmailAuditAction(status: "shipped" | "delivered", hasTrackingDetails: boolean) {
  if (status === "delivered") {
    return ORDER_DELIVERED_ACTION;
  }

  return hasTrackingDetails ? ORDER_SHIPPED_WITH_TRACKING_ACTION : ORDER_SHIPPED_ACTION;
}

export function resolveShippingAuditLookupActions(status: "shipped" | "delivered", hasTrackingDetails: boolean) {
  if (status === "shipped" && !hasTrackingDetails) {
    return [ORDER_SHIPPED_ACTION, ORDER_SHIPPED_WITH_TRACKING_ACTION];
  }

  return [resolveShippingEmailAuditAction(status, hasTrackingDetails)];
}

type ResolvedPickupTemplateFields = {
  locationName: string;
  address: string;
  cityRegion: string;
  window: string;
  instructions: string;
  details: string;
};

type ResolvedSenderConfig = {
  from: string | null;
  replyTo: string | null;
  senderName: string | null;
  mode: "platform" | "branded";
  reason: string;
};

function normalizeEmailOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return normalized.includes("@") ? normalized : null;
}

export function resolveEffectiveReplyTo(
  configuredReplyToEmail: string | null | undefined,
  supportEmail: string | null | undefined,
  platformReplyTo: string | null | undefined
) {
  return normalizeEmailOrNull(configuredReplyToEmail) ?? normalizeEmailOrNull(supportEmail) ?? normalizeEmailOrNull(platformReplyTo);
}

function parseEmailList(raw: string | undefined) {
  if (!raw) {
    return [] as string[];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function dedupeEmails(emails: Array<string | null | undefined>) {
  const unique = new Set<string>();
  for (const email of emails) {
    if (!email) continue;
    const normalized = email.trim().toLowerCase();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSnapshotString(snapshot: Record<string, unknown> | null, keys: string[]) {
  if (!snapshot) {
    return "";
  }

  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

function buildOrderLine(item: OrderEmailItem, currency: string) {
  const label = item.variantLabel ? `${item.title} (${item.variantLabel})` : item.title;
  return `- ${label} x${item.quantity} @ ${formatMoney(item.unitPriceCents, currency)}`;
}

function formatDateTimeInTimezone(iso: string, timezone: string | null) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  if (!timezone) {
    return date.toLocaleString();
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function resolveCustomerName(firstName: string | null, lastName: string | null, email: string) {
  const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  const emailPrefix = email.split("@")[0]?.trim();
  if (emailPrefix) {
    return emailPrefix;
  }

  return "Customer";
}

function resolvePickupTemplateFields(input: PickupSummaryInput): ResolvedPickupTemplateFields {
  if (input.fulfillmentMethod !== "pickup") {
    return {
      locationName: "",
      address: "",
      cityRegion: "",
      window: "",
      instructions: "",
      details: "Fulfillment: Shipping"
    };
  }

  const pickup = isRecord(input.pickupLocationSnapshot) ? input.pickupLocationSnapshot : null;
  const locationName = getSnapshotString(pickup, ["name"]) || "Pickup location";
  const city = getSnapshotString(pickup, ["city"]);
  const region = getSnapshotString(pickup, ["stateRegion", "state", "region"]);
  const cityRegion = [city, region].filter(Boolean).join(", ");
  const address = [
    getSnapshotString(pickup, ["addressLine1", "address_line1"]),
    getSnapshotString(pickup, ["addressLine2", "address_line2"]),
    city,
    region,
    getSnapshotString(pickup, ["postalCode", "postal_code"]),
    getSnapshotString(pickup, ["country", "countryCode", "country_code"])
  ]
    .filter(Boolean)
    .join(", ");
  const instructions = getSnapshotString(pickup, ["instructions", "pickupInstructions", "pickup_instructions"]);
  const window =
    input.pickupWindowStartAt && input.pickupWindowEndAt
      ? `${formatDateTimeInTimezone(input.pickupWindowStartAt, input.pickupTimezone)} - ${formatDateTimeInTimezone(input.pickupWindowEndAt, input.pickupTimezone)}${
          input.pickupTimezone ? ` (${input.pickupTimezone})` : ""
        }`
      : "To be confirmed";

  const details = [
    "Fulfillment: Pickup",
    `Pickup Location: ${locationName}`,
    address ? `Address: ${address}` : "",
    `Pickup Window: ${window}`,
    instructions ? `Pickup Instructions: ${instructions}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    locationName,
    address,
    cityRegion,
    window,
    instructions,
    details
  };
}

function buildTemplateValues(context: OrderEmailContext, values: Record<string, string>): Record<string, string> {
  const customerFirstName = context.customerFirstName?.trim() ?? "";
  const customerLastName = context.customerLastName?.trim() ?? "";
  const pickup = resolvePickupTemplateFields(context);
  const resolvedReplyTo = resolveEffectiveReplyTo(
    context.emailDocument.replyToEmail,
    context.supportEmail,
    getServerEnv().MYRIVO_EMAIL_REPLY_TO
  );
  const appUrl = getExternalAppUrl();
  const orderUrl = `${appUrl}/dashboard/customer-orders/${context.orderId}`;
  const storeUrl = context.primaryDomain ? `https://${context.primaryDomain}` : context.storeSlug ? `${appUrl}/s/${context.storeSlug}` : appUrl;
  const policiesUrl = `${storeUrl.replace(/\/$/, "")}/policies`;
  const fallbackTrackingUrl = context.trackingUrl?.trim() || orderUrl;

  return {
    orderId: context.orderId,
    orderShortId: context.orderId.slice(0, 8),
    storeName: context.storeName,
    customerEmail: context.customerEmail,
    customerFirstName,
    customerLastName,
    customerName: resolveCustomerName(context.customerFirstName, context.customerLastName, context.customerEmail),
    supportEmail: context.supportEmail ?? "",
    replyToEmail: resolvedReplyTo ?? "",
    subtotal: formatMoney(context.subtotalCents, context.currency),
    discount: formatMoney(context.discountCents, context.currency),
    total: formatMoney(context.totalCents, context.currency),
    promoCode: context.promoCode ?? "",
    orderUrl,
    storeUrl,
    policiesUrl,
    fulfillmentMethod: context.fulfillmentMethod ?? "",
    pickupLocationName: pickup.locationName,
    pickupAddress: pickup.address,
    pickupCityRegion: pickup.cityRegion,
    pickupWindow: pickup.window,
    pickupInstructions: pickup.instructions,
    pickupDetails: pickup.details,
    trackingUrl: fallbackTrackingUrl,
    trackingNumber: context.trackingNumber ?? "",
    carrier: context.carrier ?? "",
    ...values
  };
}

export function buildPickupSummaryText(input: PickupSummaryInput) {
  return resolvePickupTemplateFields(input).details;
}

function renderOrderEmailTemplate(context: OrderEmailContext, templateId: EmailStudioTemplateId, values: Record<string, string>) {
  return renderEmailStudioTemplate(context.emailDocument.templates[templateId], values, context.emailDocument.theme, context.storeName);
}

function isStoreEligibleForBrandedSender(storeId: string) {
  const env = getServerEnv();
  const policy = env.MYRIVO_BRANDED_EMAIL_POLICY ?? "disabled";
  if (policy === "all") {
    return true;
  }
  if (policy === "disabled") {
    return false;
  }
  const allowlist = new Set(
    (env.MYRIVO_BRANDED_EMAIL_STORE_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
  return allowlist.has(storeId);
}

function resolveSenderConfig(context: OrderEmailContext): ResolvedSenderConfig {
  const env = getServerEnv();
  const platformFrom = env.MYRIVO_EMAIL_PLATFORM_FROM?.trim() || env.MYRIVO_EMAIL_FROM?.trim() || null;
  const defaultReplyTo = normalizeEmailOrNull(env.MYRIVO_EMAIL_REPLY_TO);
  const brandedLocalPart = env.MYRIVO_EMAIL_BRANDED_LOCAL_PART?.trim() || "orders";
  const senderName = context.emailDocument.senderName?.trim() || context.storeName;
  const replyTo = resolveEffectiveReplyTo(context.emailDocument.replyToEmail, context.supportEmail, defaultReplyTo);

  const canUseBrandedSender =
    Boolean(context.primaryDomain) &&
    context.primaryDomainEmailSenderEnabled &&
    context.primaryDomainEmailStatus === "ready" &&
    isStoreEligibleForBrandedSender(context.storeId);

  if (canUseBrandedSender) {
    return {
      from: `${brandedLocalPart}@${context.primaryDomain}`,
      replyTo,
      senderName,
      mode: "branded",
      reason: "Primary domain sender is enabled and ready."
    };
  }

  return {
    from: platformFrom,
    replyTo,
    senderName,
    mode: "platform",
    reason: context.primaryDomainEmailSenderEnabled
      ? `Branded sender unavailable (status: ${context.primaryDomainEmailStatus}).`
      : "Branded sender not enabled."
  };
}

async function sendEmail(context: OrderEmailContext, to: string[], subject: string, text: string, html?: string | null) {
  const sender = resolveSenderConfig(context);
  if (!sender.from || to.length === 0) {
    return { sent: false, sender };
  }

  const result = await sendTransactionalEmail({
    from: sender.senderName ? `${sender.senderName} <${sender.from}>` : sender.from,
    to,
    subject,
    text,
    html,
    replyTo: sender.replyTo
  });
  if (!result.ok) {
    console.error("email send failed", result.error);
    return { sent: false, sender };
  }
  return { sent: true, sender };
}

async function loadOrderEmailContext(orderId: string): Promise<OrderEmailContext | null> {
  const supabase = createSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,store_id,customer_email,customer_first_name,customer_last_name,subtotal_cents,discount_cents,total_cents,currency,promo_code,created_at,tracking_url,tracking_number,carrier,fulfillment_method,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone"
    )
    .eq("id", orderId)
    .maybeSingle<{
      id: string;
      store_id: string;
      customer_email: string;
      customer_first_name: string | null;
      customer_last_name: string | null;
      subtotal_cents: number;
      discount_cents: number;
      total_cents: number;
      currency: string;
      promo_code: string | null;
      created_at: string;
      tracking_url: string | null;
      tracking_number: string | null;
      carrier: string | null;
      fulfillment_method: "pickup" | "shipping" | null;
      pickup_location_snapshot_json: Record<string, unknown> | null;
      pickup_window_start_at: string | null;
      pickup_window_end_at: string | null;
      pickup_timezone: string | null;
    }>();

  if (orderError) {
    throw new Error(orderError.message);
  }
  if (!order) {
    return null;
  }

  const [{ data: store }, { data: settings }, { data: experienceContent }, { data: items, error: itemsError }, { data: primaryDomain }] = await Promise.all([
    supabase.from("stores").select("id,name,slug").eq("id", order.store_id).maybeSingle<{ id: string; name: string; slug: string | null }>(),
    supabase.from("store_settings").select("support_email").eq("store_id", order.store_id).maybeSingle<{ support_email: string | null }>(),
    supabase
      .from("store_experience_content")
      .select("policies_page_json,emails_json")
      .eq("store_id", order.store_id)
      .maybeSingle<{ policies_page_json: Record<string, unknown> | null; emails_json: Record<string, unknown> | null }>(),
    supabase
      .from("order_items")
      .select("quantity,unit_price_cents,variant_label,products(title)")
      .eq("order_id", order.id)
      .returns<Array<{ quantity: number; unit_price_cents: number; variant_label: string | null; products: { title: string } | { title: string }[] | null }>>(),
    supabase
      .from("store_domains")
      .select("domain,email_sender_enabled,email_status")
      .eq("store_id", order.store_id)
      .eq("is_primary", true)
      .eq("verification_status", "verified")
      .maybeSingle<{ domain: string; email_sender_enabled: boolean; email_status: "pending" | "provisioning" | "ready" | "failed" | "not_configured" }>()
  ]);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const policiesPage = isRecord(experienceContent?.policies_page_json) ? experienceContent?.policies_page_json : {};
  const emailsSection = isRecord(experienceContent?.emails_json) ? experienceContent?.emails_json : {};
  const sectionSupportEmail = typeof policiesPage.supportEmail === "string" ? policiesPage.supportEmail : null;

  const env = getServerEnv();
  const configuredOwnerEmails = parseEmailList(env.MYRIVO_ORDER_ALERT_EMAILS);
  const ownerEmails = dedupeEmails([
    sectionSupportEmail ?? settings?.support_email ?? null,
    ...configuredOwnerEmails
  ]);

  return {
    orderId: order.id,
    storeId: order.store_id,
    storeName: store?.name ?? "Your store",
    storeSlug: store?.slug ?? null,
    customerEmail: order.customer_email,
    customerFirstName: order.customer_first_name,
    customerLastName: order.customer_last_name,
    primaryDomain: primaryDomain?.domain ?? null,
    primaryDomainEmailSenderEnabled: primaryDomain?.email_sender_enabled ?? false,
    primaryDomainEmailStatus: primaryDomain?.email_status ?? "not_configured",
    ownerEmails,
    supportEmail: sectionSupportEmail ?? settings?.support_email ?? null,
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    totalCents: order.total_cents,
    currency: order.currency,
    promoCode: order.promo_code,
    createdAt: order.created_at,
    trackingUrl: order.tracking_url,
    trackingNumber: order.tracking_number,
    carrier: order.carrier,
    fulfillmentMethod: order.fulfillment_method,
    pickupLocationSnapshot: order.pickup_location_snapshot_json,
    pickupWindowStartAt: order.pickup_window_start_at,
    pickupWindowEndAt: order.pickup_window_end_at,
    pickupTimezone: order.pickup_timezone,
    items: (items ?? []).map((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      return {
        title: product?.title ?? "Item",
        variantLabel: item.variant_label,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents
      };
    }),
    emailDocument: createEmailStudioDocumentFromSection(emailsSection, store?.name ?? "Your store")
  };
}

async function hasNotificationAudit(orderId: string, action: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id")
    .eq("entity", "order")
    .eq("entity_id", orderId)
    .eq("action", action)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("audit lookup failed", error.message);
    return false;
  }

  return Boolean(data?.id);
}

async function hasAnyNotificationAudit(orderId: string, actions: string[]) {
  if (actions.length === 0) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id")
    .eq("entity", "order")
    .eq("entity_id", orderId)
    .in("action", actions)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("audit lookup failed", error.message);
    return false;
  }

  return Boolean(data?.id);
}

async function writeNotificationAudit(order: OrderEmailContext, action: string, metadata?: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("audit_events").insert({
    store_id: order.storeId,
    actor_user_id: null,
    action,
    entity: "order",
    entity_id: order.orderId,
    metadata: metadata ?? {}
  });
}

async function resolveCustomerRecipientUserId(customerEmail: string) {
  const normalized = customerEmail.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("user_profiles").select("id").eq("email", normalized).maybeSingle<{ id: string }>();
  if (error) {
    console.error("customer profile lookup failed", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function notifyCustomerOrderLifecycle(
  context: OrderEmailContext,
  eventType:
    | "order.created.customer"
    | "order.pickup.updated.customer"
    | "order.shipping_delay.customer"
    | "order.refunded.customer"
    | "order.dispute.opened.customer"
    | "order.dispute.resolved.customer"
    | "order.fulfillment.shipped.customer"
    | "order.fulfillment.delivered.customer"
    | "order.failed.customer"
    | "order.cancelled.customer",
  title: string,
  body: string
) {
  const recipientUserId = await resolveCustomerRecipientUserId(context.customerEmail);
  if (!recipientUserId) {
    return;
  }

  await dispatchNotification({
    recipientUserId,
    storeId: context.storeId,
    eventType,
    title,
    body,
    actionUrl: `/dashboard/customer-orders/${context.orderId}`,
    channelTargets: ["in_app"],
    dedupeKey: `${eventType}:${context.orderId}:${recipientUserId}`,
    metadata: {
      orderId: context.orderId,
      storeName: context.storeName
    }
  });
}

function buildCustomerOrderStatusEmail(status: "failed" | "cancelled", context: OrderEmailContext) {
  const templateValues = buildTemplateValues(context, { status });
  return renderOrderEmailTemplate(context, status === "failed" ? "failed" : "cancelled", templateValues);
}

export async function sendOrderStatusNotification(orderId: string, status: "failed" | "cancelled" | "paid") {
  if (status === "paid") {
    await sendOrderCreatedNotifications(orderId);
    return;
  }

  try {
    const context = await loadOrderEmailContext(orderId);
    if (!context) {
      return;
    }

    const auditAction = status === "failed" ? CUSTOMER_ORDER_FAILED_ACTION : CUSTOMER_ORDER_CANCELLED_ACTION;
    const alreadySent = await hasNotificationAudit(orderId, auditAction);
    if (alreadySent) {
      return;
    }

    const rendered = buildCustomerOrderStatusEmail(status, context);
    const sendResult = await sendEmail(context, [context.customerEmail], rendered.subject, rendered.text, rendered.html);
    if (sendResult.sent) {
      await writeNotificationAudit(context, auditAction, {
        status,
        recipient: context.customerEmail,
        senderMode: sendResult.sender.mode,
        senderReason: sendResult.sender.reason,
        from: sendResult.sender.from
      });
    }

    await notifyCustomerOrderLifecycle(
      context,
      status === "failed" ? "order.failed.customer" : "order.cancelled.customer",
      status === "failed" ? "Order update required" : "Order cancelled",
      status === "failed"
        ? `There was a problem finalizing order ${context.orderId.slice(0, 8)}.`
        : `Order ${context.orderId.slice(0, 8)} was cancelled.`
    );
  } catch (error) {
    console.error("sendOrderStatusNotification failed", error);
  }
}

type PickupChangeSnapshot = {
  locationName: string;
  address: string;
  window: string;
};

function buildPickupChangeDetails(snapshot: PickupChangeSnapshot | null) {
  if (!snapshot) {
    return "";
  }

  return [
    "Fulfillment: Pickup",
    `Pickup Location: ${snapshot.locationName}`,
    snapshot.address ? `Address: ${snapshot.address}` : "",
    `Pickup Window: ${snapshot.window}`
  ]
    .filter(Boolean)
    .join("\n");
}

function resolvePickupChangeSnapshot(input: PickupSummaryInput): PickupChangeSnapshot {
  const pickup = resolvePickupTemplateFields(input);
  return {
    locationName: pickup.locationName,
    address: pickup.address,
    window: pickup.window
  };
}

export async function sendOrderPickupUpdatedNotification(
  orderId: string,
  options?: {
    reason?: string | null;
    previousPickup?: PickupSummaryInput;
  }
) {
  try {
    const context = await loadOrderEmailContext(orderId);
    if (!context || context.fulfillmentMethod !== "pickup") {
      return;
    }

    const pickupSummary = buildPickupSummaryText(context);
    const previousPickup = options?.previousPickup ? resolvePickupChangeSnapshot(options.previousPickup) : null;
    const nextPickup = resolvePickupChangeSnapshot(context);
    const templateValues = buildTemplateValues(context, {
      previousPickupDetails: buildPickupChangeDetails(previousPickup),
      pickupUpdateReason: options?.reason?.trim() || ""
    });
    const defaultText = [
      `The store updated the pickup details for your order with ${context.storeName}.`,
      "",
      `Order: ${context.orderId}`,
      previousPickup ? `Previous pickup: ${previousPickup.locationName}${previousPickup.address ? `, ${previousPickup.address}` : ""} · ${previousPickup.window}` : "",
      `New pickup: ${nextPickup.locationName}${nextPickup.address ? `, ${nextPickup.address}` : ""} · ${nextPickup.window}`,
      options?.reason?.trim() ? `Reason: ${options.reason.trim()}` : "",
      "",
      pickupSummary,
      "",
      `View order: ${templateValues.orderUrl}`,
      `Back to store: ${templateValues.storeUrl}`,
      "",
      context.supportEmail ? `Questions? Contact ${context.supportEmail}.` : "Questions? Reply to this email."
    ]
      .filter(Boolean)
      .join("\n");
    const rendered = renderOrderEmailTemplate(context, "pickupUpdated", {
      ...templateValues,
      pickupDetails: pickupSummary
    });
    const text = rendered.text || defaultText;

    const sendResult = await sendEmail(context, [context.customerEmail], rendered.subject, text, rendered.html);
    if (sendResult.sent) {
      await writeNotificationAudit(context, CUSTOMER_PICKUP_UPDATED_ACTION, {
        orderId: context.orderId,
        pickupWindowStartAt: context.pickupWindowStartAt,
        pickupWindowEndAt: context.pickupWindowEndAt,
        previousPickup: previousPickup ?? null,
        nextPickup,
        reason: options?.reason?.trim() || null,
        recipient: context.customerEmail,
        senderMode: sendResult.sender.mode,
        senderReason: sendResult.sender.reason,
        from: sendResult.sender.from
      });
    }

    await notifyCustomerOrderLifecycle(
      context,
      "order.pickup.updated.customer",
      "Pickup details updated",
      `The store updated pickup details for order ${context.orderId.slice(0, 8)}.`
    );
  } catch (error) {
    console.error("sendOrderPickupUpdatedNotification failed", error);
  }
}

function buildCustomerRefundEmail(
  context: OrderEmailContext,
  options: {
    amountCents: number;
    reasonKey: MerchantRefundReason;
    customerMessage?: string | null;
  }
) {
  const templateValues = buildTemplateValues(context, {
    refundAmount: formatMoney(options.amountCents, context.currency),
    refundReason: getRefundReasonLabel(options.reasonKey),
    refundCustomerMessage: options.customerMessage?.trim() || ""
  });
  return renderOrderEmailTemplate(context, "refundIssued", templateValues);
}

function describeShippingDelayPath(customerPath: OrderShippingDelayCustomerPath) {
  switch (customerPath) {
    case "notify_only":
      return "We’re sharing a revised ship date so you know what to expect.";
    case "request_delay_approval":
      return "Please review the revised ship date and let us know if you want us to continue with the order.";
    case "offer_cancel_or_refund":
      return "If the revised timing no longer works for you, you can request cancellation or a refund review.";
    default:
      return getShippingDelayCustomerPathLabel(customerPath);
  }
}

function buildCustomerShippingDelayEmail(
  context: OrderEmailContext,
  options: {
    delayId: string;
    reasonKey: OrderShippingDelayReasonKey;
    customerPath: OrderShippingDelayCustomerPath;
    originalShipPromise?: string | null;
    revisedShipDate?: string | null;
  }
) {
  const templateValues = buildTemplateValues(context, {
    shippingDelayReason: getShippingDelayReasonLabel(options.reasonKey),
    originalShipPromise: options.originalShipPromise?.trim() || "As soon as possible",
    revisedShipDate: options.revisedShipDate
      ? formatDateTimeInTimezone(`${options.revisedShipDate}T12:00:00.000Z`, context.pickupTimezone)
      : "We’ll confirm an updated date shortly.",
    shippingDelayCustomerPath: describeShippingDelayPath(options.customerPath)
  });

  return renderOrderEmailTemplate(context, "shippingDelay", templateValues);
}

export async function sendOrderShippingDelayNotification(
  orderId: string,
  options: {
    delayId: string;
    reasonKey: OrderShippingDelayReasonKey;
    customerPath: OrderShippingDelayCustomerPath;
    originalShipPromise?: string | null;
    revisedShipDate?: string | null;
  }
) {
  try {
    const context = await loadOrderEmailContext(orderId);
    if (!context || context.fulfillmentMethod !== "shipping") {
      return;
    }

    const auditAction = `${CUSTOMER_SHIPPING_DELAY_ACTION}:${options.delayId}:${options.reasonKey}:${options.customerPath}:${options.revisedShipDate ?? "na"}`;
    const alreadySent = await hasNotificationAudit(orderId, auditAction);
    if (alreadySent) {
      return;
    }

    const rendered = buildCustomerShippingDelayEmail(context, options);
    const sendResult = await sendEmail(context, [context.customerEmail], rendered.subject, rendered.text, rendered.html);
    if (sendResult.sent) {
      await writeNotificationAudit(context, auditAction, {
        delayId: options.delayId,
        reasonKey: options.reasonKey,
        customerPath: options.customerPath,
        originalShipPromise: options.originalShipPromise?.trim() || null,
        revisedShipDate: options.revisedShipDate ?? null,
        recipient: context.customerEmail,
        senderMode: sendResult.sender.mode,
        senderReason: sendResult.sender.reason,
        from: sendResult.sender.from
      });
    }

    await notifyCustomerOrderLifecycle(
      context,
      "order.shipping_delay.customer",
      "Shipping update",
      options.customerPath === "notify_only"
        ? `There is a revised shipping timeline for order ${context.orderId.slice(0, 8)}.`
        : `The store needs your input on a shipping delay for order ${context.orderId.slice(0, 8)}.`
    );
  } catch (error) {
    console.error("sendOrderShippingDelayNotification failed", error);
  }
}

export async function sendOrderRefundNotification(
  orderId: string,
  options: {
    refundId: string;
    amountCents: number;
    reasonKey: MerchantRefundReason;
    customerMessage?: string | null;
  }
) {
  try {
    const context = await loadOrderEmailContext(orderId);
    if (!context) {
      return;
    }

    const auditAction = `${CUSTOMER_REFUND_ISSUED_ACTION}:${options.refundId}`;
    const alreadySent = await hasNotificationAudit(orderId, auditAction);
    if (alreadySent) {
      return;
    }

    const rendered = buildCustomerRefundEmail(context, options);
    const sendResult = await sendEmail(context, [context.customerEmail], rendered.subject, rendered.text, rendered.html);
    if (sendResult.sent) {
      await writeNotificationAudit(context, auditAction, {
        refundId: options.refundId,
        amountCents: options.amountCents,
        reasonKey: options.reasonKey,
        recipient: context.customerEmail,
        senderMode: sendResult.sender.mode,
        senderReason: sendResult.sender.reason,
        from: sendResult.sender.from
      });
    }

    await notifyCustomerOrderLifecycle(
      context,
      "order.refunded.customer",
      "Refund issued",
      `A refund of ${formatMoney(options.amountCents, context.currency)} was issued for order ${context.orderId.slice(0, 8)}.`
    );
  } catch (error) {
    console.error("sendOrderRefundNotification failed", error);
  }
}

function isResolvedDisputeStatus(status: DisputeStatus) {
  return status === "won" || status === "lost" || status === "prevented" || status === "warning_closed";
}

function buildCustomerDisputeEmail(
  context: OrderEmailContext,
  options: {
    status: DisputeStatus;
    amountCents: number;
    reason: string;
    responseDueBy?: string | null;
  }
) {
  const templateValues = buildTemplateValues(context, {
    disputeAmount: formatMoney(options.amountCents, context.currency),
    disputeReason: options.reason.replaceAll("_", " "),
    disputeStatus: getDisputeStatusLabel(options.status),
    disputeResponseDueBy: options.responseDueBy
      ? formatDateTimeInTimezone(options.responseDueBy, context.pickupTimezone)
      : ""
  });
  return renderOrderEmailTemplate(context, isResolvedDisputeStatus(options.status) ? "disputeResolved" : "disputeOpened", templateValues);
}

export async function sendOrderDisputeNotification(
  orderId: string,
  options: {
    disputeId: string;
    status: DisputeStatus;
    amountCents: number;
    reason: string;
    responseDueBy?: string | null;
  }
) {
  try {
    const context = await loadOrderEmailContext(orderId);
    if (!context) {
      return;
    }

    const actionBase = isResolvedDisputeStatus(options.status) ? CUSTOMER_DISPUTE_RESOLVED_ACTION : CUSTOMER_DISPUTE_OPENED_ACTION;
    const auditAction = `${actionBase}:${options.disputeId}:${options.status}`;
    const alreadySent = await hasNotificationAudit(orderId, auditAction);
    if (alreadySent) {
      return;
    }

    const rendered = buildCustomerDisputeEmail(context, options);
    const sendResult = await sendEmail(context, [context.customerEmail], rendered.subject, rendered.text, rendered.html);
    if (sendResult.sent) {
      await writeNotificationAudit(context, auditAction, {
        disputeId: options.disputeId,
        amountCents: options.amountCents,
        reason: options.reason,
        status: options.status,
        responseDueBy: options.responseDueBy ?? null,
        recipient: context.customerEmail,
        senderMode: sendResult.sender.mode,
        senderReason: sendResult.sender.reason,
        from: sendResult.sender.from
      });
    }

    await notifyCustomerOrderLifecycle(
      context,
      isResolvedDisputeStatus(options.status) ? "order.dispute.resolved.customer" : "order.dispute.opened.customer",
      isResolvedDisputeStatus(options.status) ? "Dispute update" : "Payment dispute opened",
      isResolvedDisputeStatus(options.status)
        ? `There is an update on the payment dispute for order ${context.orderId.slice(0, 8)}.`
        : `A payment dispute was opened for order ${context.orderId.slice(0, 8)}.`
    );
  } catch (error) {
    console.error("sendOrderDisputeNotification failed", error);
  }
}

export async function sendOrderCreatedNotifications(orderId: string) {
  try {
    const [customerAlreadySent, ownerAlreadySent, context] = await Promise.all([
      hasNotificationAudit(orderId, CUSTOMER_CONFIRMATION_ACTION),
      hasNotificationAudit(orderId, OWNER_NEW_ORDER_ACTION),
      loadOrderEmailContext(orderId)
    ]);

    if (!context) {
      return;
    }

    const orderSummary = context.items.map((item) => buildOrderLine(item, context.currency)).join("\n");
    const appUrl = getExternalAppUrl();
    const ownerDashboardLink = context.storeSlug ? `${appUrl}/dashboard/stores/${context.storeSlug}/orders` : `${appUrl}/dashboard/stores`;
    const customerDashboardLink = `${appUrl}/dashboard/customer-orders/${context.orderId}`;
    const pickupSummary = buildPickupSummaryText(context);
    const ownerTemplateValues = buildTemplateValues(context, {
      items: orderSummary,
      dashboardUrl: ownerDashboardLink
    });
    const customerTemplateValues = buildTemplateValues(context, {
      items: orderSummary,
      dashboardUrl: customerDashboardLink
    });

    if (!customerAlreadySent) {
      const renderedCustomer = renderOrderEmailTemplate(context, "customerConfirmation", {
        ...customerTemplateValues,
        pickupDetails: pickupSummary
      });
      const customerSendResult = await sendEmail(
        context,
        [context.customerEmail],
        renderedCustomer.subject,
        renderedCustomer.text,
        renderedCustomer.html
      );
      if (customerSendResult.sent) {
        await writeNotificationAudit(context, CUSTOMER_CONFIRMATION_ACTION, {
          recipient: context.customerEmail,
          senderMode: customerSendResult.sender.mode,
          senderReason: customerSendResult.sender.reason,
          from: customerSendResult.sender.from
        });
      }
    }

    if (!ownerAlreadySent && context.ownerEmails.length > 0) {
      const renderedOwner = renderOrderEmailTemplate(context, "ownerNewOrder", {
        ...ownerTemplateValues,
        pickupDetails: pickupSummary
      });
      const ownerSendResult = await sendEmail(
        context,
        context.ownerEmails,
        renderedOwner.subject,
        renderedOwner.text,
        renderedOwner.html
      );
      if (ownerSendResult.sent) {
        await writeNotificationAudit(context, OWNER_NEW_ORDER_ACTION, {
          recipients: context.ownerEmails,
          senderMode: ownerSendResult.sender.mode,
          senderReason: ownerSendResult.sender.reason,
          from: ownerSendResult.sender.from
        });
      }
    }

    await Promise.all([
      notifyOwnersOrderCreated(orderId),
      notifyCustomerOrderLifecycle(
        context,
        "order.created.customer",
        "Order confirmed",
        `Your order ${context.orderId.slice(0, 8)} with ${context.storeName} has been received.`
      ),
      context.fulfillmentMethod === "pickup"
        ? notifyCustomerOrderLifecycle(
            context,
            "order.pickup.updated.customer",
            "Pickup details ready",
            `Pickup details were added for order ${context.orderId.slice(0, 8)}.`
          )
        : Promise.resolve()
    ]);
  } catch (error) {
    console.error("sendOrderCreatedNotifications failed", error);
  }
}

export async function sendOrderShippingNotification(orderId: string, status: "shipped" | "delivered") {
  try {
    const context = await loadOrderEmailContext(orderId);
    if (!context) {
      return;
    }
    if (context.fulfillmentMethod !== "shipping") {
      return;
    }

    const hasTrackingDetails = Boolean(context.trackingUrl?.trim() || context.trackingNumber?.trim());
    const action = resolveShippingEmailAuditAction(status, hasTrackingDetails);
    const auditLookupActions = resolveShippingAuditLookupActions(status, hasTrackingDetails);
    const alreadySent =
      auditLookupActions.length > 1
        ? await hasAnyNotificationAudit(orderId, auditLookupActions)
        : await hasNotificationAudit(orderId, auditLookupActions[0]!);
    if (alreadySent) {
      return;
    }

    const templateValues = buildTemplateValues(context, {
      status,
      trackingUrl: context.trackingUrl ?? "",
      trackingNumber: context.trackingNumber ?? "",
      carrier: context.carrier ?? ""
    });
    const rendered = renderOrderEmailTemplate(context, status === "shipped" ? "shipped" : "delivered", templateValues);
    const sendResult = await sendEmail(context, [context.customerEmail], rendered.subject, rendered.text, rendered.html);
    if (sendResult.sent) {
      await writeNotificationAudit(context, action, {
        status,
        hasTrackingDetails,
        recipient: context.customerEmail,
        senderMode: sendResult.sender.mode,
        senderReason: sendResult.sender.reason,
        from: sendResult.sender.from
      });
    }

    if (status === "shipped" || status === "delivered") {
      await Promise.all([
        notifyOwnersOrderFulfillmentStatus(orderId, status),
        notifyCustomerOrderLifecycle(
          context,
          status === "shipped" ? "order.fulfillment.shipped.customer" : "order.fulfillment.delivered.customer",
          status === "shipped" ? "Order shipped" : "Order delivered",
          status === "shipped"
            ? `Your order ${context.orderId.slice(0, 8)} is on the way.`
            : `Your order ${context.orderId.slice(0, 8)} was delivered.`
        )
      ]);
    }
  } catch (error) {
    console.error("sendOrderShippingNotification failed", error);
  }
}
