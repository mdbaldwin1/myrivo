import { getAppUrl, getServerEnv } from "@/lib/env";
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
  customerEmail: string;
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
  emailTemplates: {
    customerConfirmationSubjectTemplate: string | null;
    customerConfirmationBodyTemplate: string | null;
    ownerNewOrderSubjectTemplate: string | null;
    ownerNewOrderBodyTemplate: string | null;
    shippedSubjectTemplate: string | null;
    shippedBodyTemplate: string | null;
    deliveredSubjectTemplate: string | null;
    deliveredBodyTemplate: string | null;
  };
};

type PickupSummaryInput = Pick<
  OrderEmailContext,
  "fulfillmentMethod" | "pickupLocationSnapshot" | "pickupWindowStartAt" | "pickupWindowEndAt" | "pickupTimezone"
>;

const CUSTOMER_CONFIRMATION_ACTION = "email_order_confirmation_sent";
const OWNER_NEW_ORDER_ACTION = "email_owner_new_order_sent";
const ORDER_SHIPPED_ACTION = "email_order_shipped_sent";
const ORDER_DELIVERED_ACTION = "email_order_delivered_sent";

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

function getTemplateString(record: Record<string, unknown> | null | undefined, key: string) {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function applyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((resolved, [key, value]) => resolved.replaceAll(`{${key}}`, value), template);
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

export function buildPickupSummaryText(input: PickupSummaryInput) {
  if (input.fulfillmentMethod !== "pickup") {
    return "Fulfillment: Shipping";
  }

  const pickup = input.pickupLocationSnapshot;
  const name = typeof pickup?.name === "string" ? pickup.name : "Pickup location";
  const address = [pickup?.addressLine1, pickup?.city, pickup?.stateRegion, pickup?.postalCode].filter(Boolean).join(", ");
  const windowLabel =
    input.pickupWindowStartAt && input.pickupWindowEndAt
      ? `${formatDateTimeInTimezone(input.pickupWindowStartAt, input.pickupTimezone)} - ${formatDateTimeInTimezone(input.pickupWindowEndAt, input.pickupTimezone)}${
          input.pickupTimezone ? ` (${input.pickupTimezone})` : ""
        }`
      : "To be confirmed";

  return [`Fulfillment: Pickup`, `Pickup Location: ${name}`, address ? `Address: ${address}` : "", `Pickup Window: ${windowLabel}`]
    .filter(Boolean)
    .join("\n");
}

async function sendEmail(to: string[], subject: string, text: string) {
  const env = getServerEnv();
  const apiKey = env.RESEND_API_KEY;
  const from = env.MYRIVO_EMAIL_FROM;

  if (!apiKey || !from || to.length === 0) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text
    })
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    console.error("email send failed", response.status, payload);
    return false;
  }

  return true;
}

async function loadOrderEmailContext(orderId: string): Promise<OrderEmailContext | null> {
  const supabase = createSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,store_id,customer_email,subtotal_cents,discount_cents,total_cents,currency,promo_code,created_at,tracking_url,tracking_number,carrier,fulfillment_method,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone")
    .eq("id", orderId)
    .maybeSingle<{
      id: string;
      store_id: string;
      customer_email: string;
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

  const [{ data: store }, { data: settings }, { data: experienceContent }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("stores").select("id,name").eq("id", order.store_id).maybeSingle<{ id: string; name: string }>(),
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
      .returns<Array<{ quantity: number; unit_price_cents: number; variant_label: string | null; products: { title: string } | { title: string }[] | null }>>()
  ]);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const policiesPage = isRecord(experienceContent?.policies_page_json) ? experienceContent?.policies_page_json : {};
  const emailsSection = isRecord(experienceContent?.emails_json) ? experienceContent?.emails_json : {};
  const transactional = isRecord(emailsSection.transactional) ? emailsSection.transactional : {};
  const sectionSupportEmail = typeof policiesPage.supportEmail === "string" ? policiesPage.supportEmail : null;

  const env = getServerEnv();
  const configuredOwnerEmails = parseEmailList(env.MYRIVO_ORDER_ALERT_EMAILS);
  const fallbackOwnerEmails = parseEmailList(env.OWNER_ACCESS_EMAILS);
  const ownerEmails = dedupeEmails([
    sectionSupportEmail ?? settings?.support_email ?? null,
    ...configuredOwnerEmails,
    ...fallbackOwnerEmails
  ]);

  return {
    orderId: order.id,
    storeId: order.store_id,
    storeName: store?.name ?? "Your store",
    customerEmail: order.customer_email,
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
    emailTemplates: {
      customerConfirmationSubjectTemplate: getTemplateString(transactional, "customerConfirmationSubjectTemplate"),
      customerConfirmationBodyTemplate: getTemplateString(transactional, "customerConfirmationBodyTemplate"),
      ownerNewOrderSubjectTemplate: getTemplateString(transactional, "ownerNewOrderSubjectTemplate"),
      ownerNewOrderBodyTemplate: getTemplateString(transactional, "ownerNewOrderBodyTemplate"),
      shippedSubjectTemplate: getTemplateString(transactional, "shippedSubjectTemplate"),
      shippedBodyTemplate: getTemplateString(transactional, "shippedBodyTemplate"),
      deliveredSubjectTemplate: getTemplateString(transactional, "deliveredSubjectTemplate"),
      deliveredBodyTemplate: getTemplateString(transactional, "deliveredBodyTemplate")
    }
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
    const dashboardLink = `${getAppUrl()}/dashboard/orders`;
    const pickupSummary = buildPickupSummaryText(context);

    if (!customerAlreadySent) {
      const customerSubject =
        context.emailTemplates.customerConfirmationSubjectTemplate
          ? applyTemplate(context.emailTemplates.customerConfirmationSubjectTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName
            })
          : `Order confirmation #${context.orderId.slice(0, 8)} - ${context.storeName}`;
      const customerText = [
        `Thanks for your order from ${context.storeName}.`,
        "",
        `Order: ${context.orderId}`,
        `Placed: ${new Date(context.createdAt).toLocaleString()}`,
        pickupSummary,
        "",
        "Items:",
        orderSummary,
        "",
        `Subtotal: ${formatMoney(context.subtotalCents, context.currency)}`,
        `Discount: ${formatMoney(context.discountCents, context.currency)}`,
        `Total: ${formatMoney(context.totalCents, context.currency)}`,
        context.promoCode ? `Promo: ${context.promoCode}` : "",
        "",
        context.supportEmail ? `Need help? Reply to ${context.supportEmail}.` : "Need help? Reply to this email."
      ]
        .filter(Boolean)
        .join("\n");
      const resolvedCustomerText =
        context.emailTemplates.customerConfirmationBodyTemplate
          ? applyTemplate(context.emailTemplates.customerConfirmationBodyTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName,
              customerEmail: context.customerEmail,
              supportEmail: context.supportEmail ?? "",
              subtotal: formatMoney(context.subtotalCents, context.currency),
              discount: formatMoney(context.discountCents, context.currency),
              total: formatMoney(context.totalCents, context.currency),
              promoCode: context.promoCode ?? "",
              items: orderSummary
            })
          : customerText;

      const customerSent = await sendEmail([context.customerEmail], customerSubject, resolvedCustomerText);
      if (customerSent) {
        await writeNotificationAudit(context, CUSTOMER_CONFIRMATION_ACTION, { recipient: context.customerEmail });
      }
    }

    if (!ownerAlreadySent && context.ownerEmails.length > 0) {
      const ownerSubject =
        context.emailTemplates.ownerNewOrderSubjectTemplate
          ? applyTemplate(context.emailTemplates.ownerNewOrderSubjectTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName
            })
          : `New order ${context.orderId.slice(0, 8)} - ${context.storeName}`;
      const ownerText = [
        "A new order was placed.",
        "",
        `Order: ${context.orderId}`,
        `Customer: ${context.customerEmail}`,
        `Placed: ${new Date(context.createdAt).toLocaleString()}`,
        pickupSummary,
        "",
        "Items:",
        orderSummary,
        "",
        `Total: ${formatMoney(context.totalCents, context.currency)}`,
        "",
        `Open dashboard: ${dashboardLink}`
      ].join("\n");
      const resolvedOwnerText =
        context.emailTemplates.ownerNewOrderBodyTemplate
          ? applyTemplate(context.emailTemplates.ownerNewOrderBodyTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName,
              customerEmail: context.customerEmail,
              total: formatMoney(context.totalCents, context.currency),
              dashboardUrl: dashboardLink,
              items: orderSummary
            })
          : ownerText;

      const ownerSent = await sendEmail(context.ownerEmails, ownerSubject, resolvedOwnerText);
      if (ownerSent) {
        await writeNotificationAudit(context, OWNER_NEW_ORDER_ACTION, { recipients: context.ownerEmails });
      }
    }
  } catch (error) {
    console.error("sendOrderCreatedNotifications failed", error);
  }
}

export async function sendOrderShippingNotification(orderId: string, status: "shipped" | "delivered") {
  const action = status === "shipped" ? ORDER_SHIPPED_ACTION : ORDER_DELIVERED_ACTION;

  try {
    const alreadySent = await hasNotificationAudit(orderId, action);
    if (alreadySent) {
      return;
    }

    const context = await loadOrderEmailContext(orderId);
    if (!context) {
      return;
    }

    const subject =
      status === "shipped"
        ? context.emailTemplates.shippedSubjectTemplate
          ? applyTemplate(context.emailTemplates.shippedSubjectTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName
            })
          : `Your order ${context.orderId.slice(0, 8)} has shipped`
        : context.emailTemplates.deliveredSubjectTemplate
          ? applyTemplate(context.emailTemplates.deliveredSubjectTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName
            })
          : `Your order ${context.orderId.slice(0, 8)} was delivered`;
    const trackingLine =
      context.trackingUrl || context.trackingNumber
        ? `Tracking: ${context.trackingUrl ?? context.trackingNumber}`
        : "Tracking details are not yet available.";

    const text = [
      `Update from ${context.storeName}: your order is ${status}.`,
      "",
      `Order: ${context.orderId}`,
      `Status: ${status}`,
      trackingLine,
      context.carrier ? `Carrier: ${context.carrier}` : "",
      "",
      context.supportEmail ? `Questions? Contact ${context.supportEmail}.` : "Questions? Reply to this email."
    ]
      .filter(Boolean)
      .join("\n");
    const resolvedText =
      status === "shipped"
        ? context.emailTemplates.shippedBodyTemplate
          ? applyTemplate(context.emailTemplates.shippedBodyTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName,
              status,
              trackingUrl: context.trackingUrl ?? "",
              trackingNumber: context.trackingNumber ?? "",
              carrier: context.carrier ?? "",
              supportEmail: context.supportEmail ?? ""
            })
          : text
        : context.emailTemplates.deliveredBodyTemplate
          ? applyTemplate(context.emailTemplates.deliveredBodyTemplate, {
              orderId: context.orderId,
              orderShortId: context.orderId.slice(0, 8),
              storeName: context.storeName,
              status,
              trackingUrl: context.trackingUrl ?? "",
              trackingNumber: context.trackingNumber ?? "",
              carrier: context.carrier ?? "",
              supportEmail: context.supportEmail ?? ""
            })
          : text;

    const sent = await sendEmail([context.customerEmail], subject, resolvedText);
    if (sent) {
      await writeNotificationAudit(context, action, { status, recipient: context.customerEmail });
    }
  } catch (error) {
    console.error("sendOrderShippingNotification failed", error);
  }
}
