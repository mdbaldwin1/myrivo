import { richTextToPlainText, sanitizeRichTextHtml } from "@/lib/rich-text";

export const emailStudioTemplateIds = [
  "customerConfirmation",
  "ownerNewOrder",
  "pickupUpdated",
  "shippingDelay",
  "refundIssued",
  "disputeOpened",
  "disputeResolved",
  "failed",
  "cancelled",
  "shipped",
  "delivered"
] as const;

export type EmailMessageType = "transactional" | "marketing";

export const EMAIL_COMPLIANCE_INFORMATION_ARCHITECTURE = {
  emailStudioOwns: [
    "transactional lifecycle templates tied to orders and operational events",
    "sender name and reply-to presentation for transactional email",
    "template copy, CTA language, and branded layout for lifecycle messages"
  ],
  subscriberToolsOwn: [
    "marketing-list growth and subscriber status",
    "unsubscribe and suppression handling for promotional email",
    "future campaign-level consent provenance and reporting"
  ],
  importantBoundaries: [
    "transactional email is not gated by marketing subscriber status",
    "marketing email should use subscriber consent and suppression state",
    "Email Studio is not the place to launch promotional campaigns"
  ]
} as const;

export type EmailStudioTemplateId = (typeof emailStudioTemplateIds)[number];
export const emailStudioThemeRadiusOptions = ["sharp", "rounded", "pill"] as const;
export type EmailStudioThemeRadius = (typeof emailStudioThemeRadiusOptions)[number];

export type EmailStudioFieldToken = {
  token: string;
  label: string;
  description: string;
  category: "order" | "customer" | "money" | "links" | "fulfillment" | "shipping" | "refunds" | "disputes";
};

export const EMAIL_STUDIO_TOKENS: readonly EmailStudioFieldToken[] = [
  { token: "{orderId}", label: "Order ID", description: "Full order identifier.", category: "order" },
  { token: "{orderShortId}", label: "Short order ID", description: "Shortened order identifier.", category: "order" },
  { token: "{storeName}", label: "Store name", description: "Store display name.", category: "order" },
  { token: "{customerName}", label: "Customer name", description: "Resolved customer full name.", category: "customer" },
  { token: "{customerFirstName}", label: "Customer first name", description: "Customer first name when available.", category: "customer" },
  { token: "{customerLastName}", label: "Customer last name", description: "Customer last name when available.", category: "customer" },
  { token: "{customerEmail}", label: "Customer email", description: "Customer email address.", category: "customer" },
  { token: "{supportEmail}", label: "Support email", description: "Store support email fallback.", category: "customer" },
  { token: "{replyToEmail}", label: "Reply-to email", description: "Resolved reply-to address.", category: "customer" },
  { token: "{subtotal}", label: "Subtotal", description: "Formatted subtotal amount.", category: "money" },
  { token: "{discount}", label: "Discount", description: "Formatted discount amount.", category: "money" },
  { token: "{total}", label: "Total", description: "Formatted order total.", category: "money" },
  { token: "{promoCode}", label: "Promo code", description: "Applied promo code, if any.", category: "money" },
  { token: "{items}", label: "Items summary", description: "Line-item summary text.", category: "order" },
  { token: "{dashboardUrl}", label: "Dashboard URL", description: "Owner or customer dashboard deep link.", category: "links" },
  { token: "{orderUrl}", label: "Order URL", description: "Customer order details URL.", category: "links" },
  { token: "{storeUrl}", label: "Store URL", description: "Storefront URL.", category: "links" },
  { token: "{policiesUrl}", label: "Policies URL", description: "Store policies page URL.", category: "links" },
  { token: "{fulfillmentMethod}", label: "Fulfillment method", description: "Pickup or shipping.", category: "fulfillment" },
  { token: "{pickupLocationName}", label: "Pickup location", description: "Resolved pickup location name.", category: "fulfillment" },
  { token: "{pickupAddress}", label: "Pickup address", description: "Pickup address text.", category: "fulfillment" },
  { token: "{pickupCityRegion}", label: "Pickup city/region", description: "Pickup city and region text.", category: "fulfillment" },
  { token: "{pickupWindow}", label: "Pickup window", description: "Pickup timeslot or date range.", category: "fulfillment" },
  { token: "{pickupInstructions}", label: "Pickup instructions", description: "Operational pickup instructions.", category: "fulfillment" },
  { token: "{pickupDetails}", label: "Pickup summary", description: "Combined pickup details block.", category: "fulfillment" },
  {
    token: "{previousPickupDetails}",
    label: "Previous pickup details",
    description: "Previous pickup summary before a store override.",
    category: "fulfillment"
  },
  {
    token: "{pickupUpdateReason}",
    label: "Pickup update reason",
    description: "Store-provided reason for changing pickup details.",
    category: "fulfillment"
  },
  { token: "{status}", label: "Status", description: "Shipping lifecycle status.", category: "shipping" },
  { token: "{trackingUrl}", label: "Tracking URL", description: "Shipment tracking URL.", category: "shipping" },
  { token: "{trackingNumber}", label: "Tracking number", description: "Shipment tracking number.", category: "shipping" },
  { token: "{carrier}", label: "Carrier", description: "Shipping carrier name.", category: "shipping" },
  { token: "{shippingDelayReason}", label: "Delay reason", description: "Human-readable shipping delay reason.", category: "shipping" },
  {
    token: "{originalShipPromise}",
    label: "Original ship promise",
    description: "Original promised ship-by language captured by the store.",
    category: "shipping"
  },
  {
    token: "{revisedShipDate}",
    label: "Revised ship date",
    description: "New estimated ship date for a delayed order.",
    category: "shipping"
  },
  {
    token: "{shippingDelayCustomerPath}",
    label: "Delay resolution path",
    description: "How the store is asking the customer to respond to the delay.",
    category: "shipping"
  },
  { token: "{refundAmount}", label: "Refund amount", description: "Formatted refund amount.", category: "refunds" },
  { token: "{refundReason}", label: "Refund reason", description: "Merchant-selected refund reason label.", category: "refunds" },
  { token: "{refundCustomerMessage}", label: "Refund customer note", description: "Optional customer-facing note saved with the refund.", category: "refunds" },
  { token: "{disputeAmount}", label: "Dispute amount", description: "Formatted disputed amount.", category: "disputes" },
  { token: "{disputeReason}", label: "Dispute reason", description: "Stripe dispute reason.", category: "disputes" },
  { token: "{disputeStatus}", label: "Dispute status", description: "Human-readable dispute status.", category: "disputes" },
  { token: "{disputeResponseDueBy}", label: "Dispute response due by", description: "Response due date when available.", category: "disputes" }
] as const;

export type EmailStudioThemeDocument = {
  canvasColor: string;
  cardColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  buttonTextColor: string;
  borderRadius: EmailStudioThemeRadius;
};

export type EmailStudioTemplateDocument = {
  id: EmailStudioTemplateId;
  messageType: "transactional";
  label: string;
  audience: "customer" | "owner";
  subject: string;
  preheader: string;
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
  description: string;
};

export type EmailStudioDocument = {
  messageType: "transactional";
  senderName: string;
  replyToEmail: string;
  theme: EmailStudioThemeDocument;
  templates: Record<EmailStudioTemplateId, EmailStudioTemplateDocument>;
};

type TransactionalRecord = Record<string, unknown>;

function getString(record: TransactionalRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeThemeColor(value: string, fallback: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

function normalizeThemeRadius(value: string): EmailStudioThemeRadius {
  return emailStudioThemeRadiusOptions.includes(value as EmailStudioThemeRadius) ? (value as EmailStudioThemeRadius) : "rounded";
}

function paragraphsToHtml(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function buildDefaultTheme(): EmailStudioThemeDocument {
  return {
    canvasColor: "#F4F1EC",
    cardColor: "#FFFFFF",
    textColor: "#1F2937",
    mutedColor: "#6B7280",
    accentColor: "#7C5C3B",
    buttonTextColor: "#FFFFFF",
    borderRadius: "rounded"
  };
}

function buildDefaultTemplateMap(storeName: string): Record<EmailStudioTemplateId, EmailStudioTemplateDocument> {
  return {
    customerConfirmation: {
      id: "customerConfirmation",
      messageType: "transactional",
      label: "Customer order confirmation",
      audience: "customer",
      description: "Sent to customers right after an order is placed.",
      subject: `Order confirmation #{orderShortId} - ${storeName}`,
      preheader: "Your order is in and we’ll keep you posted.",
      headline: "Thanks for your order",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "We’ve received your order from {storeName}.",
          "Order: {orderId}",
          "{pickupDetails}",
          "Items:",
          "{items}",
          "Subtotal: {subtotal}",
          "Discount: {discount}",
          "Total: {total}"
        ])
      ),
      ctaLabel: "View order",
      ctaUrl: "{orderUrl}",
      footerNote: "Need help? Reply to {replyToEmail}."
    },
    ownerNewOrder: {
      id: "ownerNewOrder",
      messageType: "transactional",
      label: "Owner new order alert",
      audience: "owner",
      description: "Sent to store owners when a new order is placed.",
      subject: `New order {orderShortId} - ${storeName}`,
      preheader: "A new order just came in.",
      headline: "New order placed",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "A new order was placed.",
          "Order: {orderId}",
          "Customer: {customerEmail}",
          "{pickupDetails}",
          "Items:",
          "{items}",
          "Total: {total}"
        ])
      ),
      ctaLabel: "Open dashboard",
      ctaUrl: "{dashboardUrl}",
      footerNote: "Review the order in your dashboard."
    },
    pickupUpdated: {
      id: "pickupUpdated",
      messageType: "transactional",
      label: "Pickup updated",
      audience: "customer",
      description: "Sent when the store changes the pickup location or window for an order.",
      subject: "Pickup details updated for order {orderShortId}",
      preheader: "Your pickup details were updated by the store.",
      headline: "Your pickup details changed",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "The store updated the pickup details for your order with {storeName}.",
          "Order: {orderId}",
          "Previous pickup details:",
          "{previousPickupDetails}",
          "New pickup details:",
          "{pickupDetails}",
          "Reason: {pickupUpdateReason}"
        ])
      ),
      ctaLabel: "Review order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}."
    },
    shippingDelay: {
      id: "shippingDelay",
      messageType: "transactional",
      label: "Shipping delay update",
      audience: "customer",
      description: "Sent when the store needs to communicate or resolve a shipping delay.",
      subject: "Shipping update for order {orderShortId}",
      preheader: "There is an update to your order timeline.",
      headline: "We have an update on your shipment",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "There is a shipping delay affecting your order with {storeName}.",
          "Order: {orderId}",
          "Reason: {shippingDelayReason}",
          "Original timing: {originalShipPromise}",
          "Revised ship date: {revisedShipDate}",
          "Next step: {shippingDelayCustomerPath}"
        ])
      ),
      ctaLabel: "Review order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}. Store policies: {policiesUrl}"
    },
    refundIssued: {
      id: "refundIssued",
      messageType: "transactional",
      label: "Refund issued",
      audience: "customer",
      description: "Sent when a refund has been successfully issued for an order.",
      subject: "Refund issued for order {orderShortId}",
      preheader: "A refund was issued for your order.",
      headline: "Your refund is on the way",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "A refund has been issued for your order with {storeName}.",
          "Order: {orderId}",
          "Refund amount: {refundAmount}",
          "Reason: {refundReason}",
          "Note from the store: {refundCustomerMessage}"
        ])
      ),
      ctaLabel: "Review order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}. Store policies: {policiesUrl}"
    },
    disputeOpened: {
      id: "disputeOpened",
      messageType: "transactional",
      label: "Dispute opened",
      audience: "customer",
      description: "Sent when a payment dispute or chargeback opens on an order.",
      subject: "We’re reviewing a payment dispute for order {orderShortId}",
      preheader: "A payment dispute was opened for your order.",
      headline: "A payment dispute is under review",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "A payment dispute was opened for your order with {storeName}.",
          "Order: {orderId}",
          "Disputed amount: {disputeAmount}",
          "Reason: {disputeReason}",
          "Status: {disputeStatus}",
          "Response due by: {disputeResponseDueBy}"
        ])
      ),
      ctaLabel: "View order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}. Store policies: {policiesUrl}"
    },
    disputeResolved: {
      id: "disputeResolved",
      messageType: "transactional",
      label: "Dispute resolved",
      audience: "customer",
      description: "Sent when a payment dispute reaches a terminal outcome.",
      subject: "Dispute update for order {orderShortId}",
      preheader: "Your payment dispute status changed.",
      headline: "Your dispute status changed",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "There’s an update on the payment dispute for your order with {storeName}.",
          "Order: {orderId}",
          "Disputed amount: {disputeAmount}",
          "Reason: {disputeReason}",
          "Current status: {disputeStatus}"
        ])
      ),
      ctaLabel: "View order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}. Store policies: {policiesUrl}"
    },
    failed: {
      id: "failed",
      messageType: "transactional",
      label: "Order failed",
      audience: "customer",
      description: "Sent when there was a problem finalizing an order.",
      subject: "There was a problem with order {orderShortId}",
      preheader: "Your order needs attention.",
      headline: "There was a problem with your order",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "There was a problem finalizing your order with {storeName}.",
          "Order: {orderId}",
          "Please review the order details and reach out if you need help."
        ])
      ),
      ctaLabel: "View order",
      ctaUrl: "{orderUrl}",
      footerNote: "Need help? Contact {replyToEmail}."
    },
    cancelled: {
      id: "cancelled",
      messageType: "transactional",
      label: "Order cancelled",
      audience: "customer",
      description: "Sent when an order is cancelled.",
      subject: "Order {orderShortId} was cancelled",
      preheader: "Your order has been cancelled.",
      headline: "Your order was cancelled",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "Your order with {storeName} was cancelled.",
          "Order: {orderId}",
          "You can review the order details or return to the storefront."
        ])
      ),
      ctaLabel: "View order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}."
    },
    shipped: {
      id: "shipped",
      messageType: "transactional",
      label: "Order shipped",
      audience: "customer",
      description: "Sent when a shipped order is marked shipped.",
      subject: "Your order {orderShortId} has shipped",
      preheader: "Your package is on the way.",
      headline: "Your order has shipped",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "Update from {storeName}: your order is {status}.",
          "Order: {orderId}",
          "Tracking: {trackingUrl}",
          "Carrier: {carrier}"
        ])
      ),
      ctaLabel: "Track order",
      ctaUrl: "{trackingUrl}",
      footerNote: "Questions? Contact {replyToEmail}."
    },
    delivered: {
      id: "delivered",
      messageType: "transactional",
      label: "Order delivered",
      audience: "customer",
      description: "Sent when a shipped order is marked delivered.",
      subject: "Your order {orderShortId} was delivered",
      preheader: "Your order was delivered.",
      headline: "Your order was delivered",
      bodyHtml: sanitizeRichTextHtml(
        paragraphsToHtml([
          "Update from {storeName}: your order is {status}.",
          "Order: {orderId}",
          "Tracking: {trackingUrl}",
          "Carrier: {carrier}"
        ])
      ),
      ctaLabel: "View order",
      ctaUrl: "{orderUrl}",
      footerNote: "Questions? Contact {replyToEmail}."
    }
  };
}

export function buildDefaultEmailStudioDocument(storeName = "Your store"): EmailStudioDocument {
  return {
    messageType: "transactional",
    senderName: "",
    replyToEmail: "",
    theme: buildDefaultTheme(),
    templates: buildDefaultTemplateMap(storeName)
  };
}

type StoredTemplateRecord = {
  subject?: unknown;
  preheader?: unknown;
  headline?: unknown;
  bodyHtml?: unknown;
  ctaLabel?: unknown;
  ctaUrl?: unknown;
  footerNote?: unknown;
};

function getStoredTemplate(transactional: TransactionalRecord, templateId: EmailStudioTemplateId): StoredTemplateRecord | null {
  const templates = transactional.templates;
  if (!isRecord(templates)) {
    return null;
  }

  const template = templates[templateId];
  return isRecord(template) ? (template as StoredTemplateRecord) : null;
}

function resolveLegacyTemplateSubject(transactional: TransactionalRecord, templateId: EmailStudioTemplateId) {
  switch (templateId) {
    case "customerConfirmation":
      return getString(transactional, "customerConfirmationSubjectTemplate");
    case "ownerNewOrder":
      return getString(transactional, "ownerNewOrderSubjectTemplate");
    case "pickupUpdated":
      return getString(transactional, "pickupUpdatedSubjectTemplate");
    case "shippingDelay":
      return getString(transactional, "shippingDelaySubjectTemplate");
    case "refundIssued":
      return getString(transactional, "refundIssuedSubjectTemplate");
    case "disputeOpened":
      return getString(transactional, "disputeOpenedSubjectTemplate");
    case "disputeResolved":
      return getString(transactional, "disputeResolvedSubjectTemplate");
    case "failed":
      return getString(transactional, "failedSubjectTemplate");
    case "cancelled":
      return getString(transactional, "cancelledSubjectTemplate");
    case "shipped":
      return getString(transactional, "shippedSubjectTemplate");
    case "delivered":
      return getString(transactional, "deliveredSubjectTemplate");
  }
}

function resolveLegacyTemplateBody(transactional: TransactionalRecord, templateId: EmailStudioTemplateId) {
  switch (templateId) {
    case "customerConfirmation":
      return getString(transactional, "customerConfirmationBodyTemplate");
    case "ownerNewOrder":
      return getString(transactional, "ownerNewOrderBodyTemplate");
    case "pickupUpdated":
      return getString(transactional, "pickupUpdatedBodyTemplate");
    case "shippingDelay":
      return getString(transactional, "shippingDelayBodyTemplate");
    case "refundIssued":
      return getString(transactional, "refundIssuedBodyTemplate");
    case "disputeOpened":
      return getString(transactional, "disputeOpenedBodyTemplate");
    case "disputeResolved":
      return getString(transactional, "disputeResolvedBodyTemplate");
    case "failed":
      return getString(transactional, "failedBodyTemplate");
    case "cancelled":
      return getString(transactional, "cancelledBodyTemplate");
    case "shipped":
      return getString(transactional, "shippedBodyTemplate");
    case "delivered":
      return getString(transactional, "deliveredBodyTemplate");
  }
}

function legacyBodyToHtml(body: string, fallbackHtml: string) {
  if (!body.trim()) {
    return fallbackHtml;
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${chunk.replaceAll("\n", "<br />")}</p>`)
    .join("");

  return sanitizeRichTextHtml(paragraphs);
}

export function createEmailStudioDocumentFromSection(section: Record<string, unknown>, storeName?: string | null): EmailStudioDocument {
  const defaults = buildDefaultEmailStudioDocument(storeName?.trim() || "Your store");
  const transactional = isRecord(section.transactional) ? section.transactional : {};
  const themeRecord = isRecord(transactional.theme) ? transactional.theme : {};

  const templates = emailStudioTemplateIds.reduce<Record<EmailStudioTemplateId, EmailStudioTemplateDocument>>((result, templateId) => {
    const fallback = defaults.templates[templateId];
    const storedTemplate = getStoredTemplate(transactional, templateId);
    const legacySubject = resolveLegacyTemplateSubject(transactional, templateId);
    const legacyBody = resolveLegacyTemplateBody(transactional, templateId);
    const bodyHtml =
      typeof storedTemplate?.bodyHtml === "string" && storedTemplate.bodyHtml.trim()
        ? sanitizeRichTextHtml(storedTemplate.bodyHtml)
        : legacyBody
          ? legacyBodyToHtml(legacyBody, fallback.bodyHtml)
          : fallback.bodyHtml;

    result[templateId] = {
      ...fallback,
      subject:
        (typeof storedTemplate?.subject === "string" && storedTemplate.subject.trim()) || legacySubject || fallback.subject,
      preheader: (typeof storedTemplate?.preheader === "string" && storedTemplate.preheader) || fallback.preheader,
      headline: (typeof storedTemplate?.headline === "string" && storedTemplate.headline) || fallback.headline,
      bodyHtml,
      ctaLabel: (typeof storedTemplate?.ctaLabel === "string" && storedTemplate.ctaLabel) || fallback.ctaLabel,
      ctaUrl: (typeof storedTemplate?.ctaUrl === "string" && storedTemplate.ctaUrl) || fallback.ctaUrl,
      footerNote: (typeof storedTemplate?.footerNote === "string" && storedTemplate.footerNote) || fallback.footerNote
    };
    return result;
  }, {} as Record<EmailStudioTemplateId, EmailStudioTemplateDocument>);

  return {
    messageType: "transactional",
    senderName: getString(transactional, "senderName"),
    replyToEmail: getString(transactional, "replyToEmail"),
    theme: {
      canvasColor: normalizeThemeColor(getString(themeRecord, "canvasColor"), defaults.theme.canvasColor),
      cardColor: normalizeThemeColor(getString(themeRecord, "cardColor"), defaults.theme.cardColor),
      textColor: normalizeThemeColor(getString(themeRecord, "textColor"), defaults.theme.textColor),
      mutedColor: normalizeThemeColor(getString(themeRecord, "mutedColor"), defaults.theme.mutedColor),
      accentColor: normalizeThemeColor(getString(themeRecord, "accentColor"), defaults.theme.accentColor),
      buttonTextColor: normalizeThemeColor(getString(themeRecord, "buttonTextColor"), defaults.theme.buttonTextColor),
      borderRadius: normalizeThemeRadius(getString(themeRecord, "borderRadius"))
    },
    templates
  };
}

export function serializeEmailStudioDocument(document: EmailStudioDocument) {
  return {
    transactional: {
      senderName: document.senderName.trim() || "",
      replyToEmail: document.replyToEmail.trim() || "",
      theme: {
        canvasColor: document.theme.canvasColor,
        cardColor: document.theme.cardColor,
        textColor: document.theme.textColor,
        mutedColor: document.theme.mutedColor,
        accentColor: document.theme.accentColor,
        buttonTextColor: document.theme.buttonTextColor,
        borderRadius: document.theme.borderRadius
      },
      templates: Object.fromEntries(
        emailStudioTemplateIds.map((templateId) => {
          const template = document.templates[templateId];
          return [
            templateId,
            {
              subject: template.subject.trim(),
              preheader: template.preheader.trim(),
              headline: template.headline.trim(),
              bodyHtml: sanitizeRichTextHtml(template.bodyHtml),
              ctaLabel: template.ctaLabel.trim(),
              ctaUrl: template.ctaUrl.trim(),
              footerNote: template.footerNote.trim()
            }
          ];
        })
      ),
      customerConfirmationSubjectTemplate: document.templates.customerConfirmation.subject.trim(),
      customerConfirmationBodyTemplate: richTextToPlainText(document.templates.customerConfirmation.bodyHtml),
      ownerNewOrderSubjectTemplate: document.templates.ownerNewOrder.subject.trim(),
      ownerNewOrderBodyTemplate: richTextToPlainText(document.templates.ownerNewOrder.bodyHtml),
      pickupUpdatedSubjectTemplate: document.templates.pickupUpdated.subject.trim(),
      pickupUpdatedBodyTemplate: richTextToPlainText(document.templates.pickupUpdated.bodyHtml),
      shippingDelaySubjectTemplate: document.templates.shippingDelay.subject.trim(),
      shippingDelayBodyTemplate: richTextToPlainText(document.templates.shippingDelay.bodyHtml),
      refundIssuedSubjectTemplate: document.templates.refundIssued.subject.trim(),
      refundIssuedBodyTemplate: richTextToPlainText(document.templates.refundIssued.bodyHtml),
      disputeOpenedSubjectTemplate: document.templates.disputeOpened.subject.trim(),
      disputeOpenedBodyTemplate: richTextToPlainText(document.templates.disputeOpened.bodyHtml),
      disputeResolvedSubjectTemplate: document.templates.disputeResolved.subject.trim(),
      disputeResolvedBodyTemplate: richTextToPlainText(document.templates.disputeResolved.bodyHtml),
      failedSubjectTemplate: document.templates.failed.subject.trim(),
      failedBodyTemplate: richTextToPlainText(document.templates.failed.bodyHtml),
      cancelledSubjectTemplate: document.templates.cancelled.subject.trim(),
      cancelledBodyTemplate: richTextToPlainText(document.templates.cancelled.bodyHtml),
      shippedSubjectTemplate: document.templates.shipped.subject.trim(),
      shippedBodyTemplate: richTextToPlainText(document.templates.shipped.bodyHtml),
      deliveredSubjectTemplate: document.templates.delivered.subject.trim(),
      deliveredBodyTemplate: richTextToPlainText(document.templates.delivered.bodyHtml)
    }
  };
}
