import { renderEmailStudioTemplate } from "@/lib/email-studio/render";
import type { EmailStudioTemplateDocument, EmailStudioTemplateId, EmailStudioThemeDocument } from "@/lib/email-studio/model";

export type EmailStudioPreviewScenarioId = "pickup" | "shipping";

export type EmailStudioPreviewScenario = {
  id: EmailStudioPreviewScenarioId;
  label: string;
  values: Record<string, string>;
};

export const emailStudioPreviewScenarios: readonly EmailStudioPreviewScenario[] = [
  {
    id: "pickup",
    label: "Pickup order",
    values: {
      orderId: "ord_01HZX3K9P8WA",
      orderShortId: "01HZX3K9",
      storeName: "Olive Mercantile",
      customerName: "Jordan Lee",
      customerFirstName: "Jordan",
      customerLastName: "Lee",
      customerEmail: "jordan@example.com",
      supportEmail: "support@olivemercantile.com",
      replyToEmail: "support@olivemercantile.com",
      subtotal: "$42.00",
      discount: "$4.00",
      total: "$38.00",
      promoCode: "SPRING",
      items: "- Citrus Balm x1 @ $18.00\n- Lavender Tea x2 @ $12.00",
      dashboardUrl: "https://myrivo.local/dashboard/stores/olive-mercantile/orders",
      orderUrl: "https://myrivo.local/dashboard/customer-orders/ord_01HZX3K9P8WA",
      storeUrl: "https://olivemercantile.com",
      policiesUrl: "https://olivemercantile.com/policies",
      fulfillmentMethod: "pickup",
      pickupLocationName: "Downtown counter",
      pickupAddress: "21 Center St, Burlington, VT 05401",
      pickupCityRegion: "Burlington, VT",
      pickupWindow: "Mar 15, 2026 2:00 PM - Mar 15, 2026 4:00 PM (America/New_York)",
      pickupInstructions: "Bring your order confirmation and photo ID.",
      pickupDetails:
        "Fulfillment: Pickup\nPickup Location: Downtown counter\nAddress: 21 Center St, Burlington, VT 05401\nPickup Window: Mar 15, 2026 2:00 PM - Mar 15, 2026 4:00 PM (America/New_York)\nPickup Instructions: Bring your order confirmation and photo ID.",
      previousPickupDetails:
        "Fulfillment: Pickup\nPickup Location: Riverside porch\nAddress: 8 River Rd, Burlington, VT 05401\nPickup Window: Mar 14, 2026 10:00 AM - Mar 14, 2026 12:00 PM (America/New_York)\nPickup Instructions: Text when you arrive.",
      pickupUpdateReason: "The original pickup window is no longer available.",
      refundAmount: "$18.00",
      refundReason: "Customer request",
      refundCustomerMessage: "We’ve refunded the damaged item and hope the replacement works out better.",
      disputeAmount: "$38.00",
      disputeReason: "fraudulent",
      disputeStatus: "Response needed",
      disputeResponseDueBy: "Mar 20, 2026 5:00 PM (America/New_York)",
      status: "ready for pickup",
      trackingUrl: "",
      trackingNumber: "",
      carrier: "",
      shippingDelayReason: "Carrier disruption",
      originalShipPromise: "Ships by Mar 16, 2026",
      revisedShipDate: "Mar 19, 2026",
      shippingDelayCustomerPath: "Please review the revised ship date and confirm whether you want us to continue."
    }
  },
  {
    id: "shipping",
    label: "Shipped order",
    values: {
      orderId: "ord_01HZZ0KT3D8C",
      orderShortId: "01HZZ0KT",
      storeName: "Olive Mercantile",
      customerName: "Jordan Lee",
      customerFirstName: "Jordan",
      customerLastName: "Lee",
      customerEmail: "jordan@example.com",
      supportEmail: "support@olivemercantile.com",
      replyToEmail: "support@olivemercantile.com",
      subtotal: "$72.00",
      discount: "$0.00",
      total: "$72.00",
      promoCode: "",
      items: "- Citrus Balm x2 @ $18.00\n- Body Oil x2 @ $18.00",
      dashboardUrl: "https://myrivo.local/dashboard/stores/olive-mercantile/orders",
      orderUrl: "https://myrivo.local/dashboard/customer-orders/ord_01HZZ0KT3D8C",
      storeUrl: "https://olivemercantile.com",
      policiesUrl: "https://olivemercantile.com/policies",
      fulfillmentMethod: "shipping",
      pickupLocationName: "",
      pickupAddress: "",
      pickupCityRegion: "",
      pickupWindow: "",
      pickupInstructions: "",
      pickupDetails: "Fulfillment: Shipping",
      previousPickupDetails: "",
      pickupUpdateReason: "",
      refundAmount: "$24.00",
      refundReason: "Shipping failure",
      refundCustomerMessage: "We’ve refunded the missing item while we investigate with the carrier.",
      disputeAmount: "$72.00",
      disputeReason: "product_not_received",
      disputeStatus: "Under review",
      disputeResponseDueBy: "Mar 22, 2026 4:00 PM (America/New_York)",
      status: "shipped",
      trackingUrl: "https://tracking.example.com/ZX123456789US",
      trackingNumber: "ZX123456789US",
      carrier: "UPS",
      shippingDelayReason: "Carrier disruption",
      originalShipPromise: "Ships by Mar 16, 2026",
      revisedShipDate: "Mar 19, 2026",
      shippingDelayCustomerPath: "Please review the revised ship date and confirm whether you want us to continue."
    }
  }
] as const;

export function applyEmailStudioPreviewTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((resolved, [key, value]) => resolved.replaceAll(`{${key}}`, value), template);
}

export function resolveEmailStudioPreviewScenario(templateId: EmailStudioTemplateId, scenarioId: EmailStudioPreviewScenarioId) {
  const base = emailStudioPreviewScenarios.find((scenario) => scenario.id === scenarioId) ?? emailStudioPreviewScenarios[0]!;

  if (
    templateId === "customerConfirmation" ||
    templateId === "ownerNewOrder" ||
    templateId === "pickupUpdated" ||
    templateId === "refundIssued"
  ) {
    return emailStudioPreviewScenarios[0]!;
  }

  return base.id === "shipping" ? base : emailStudioPreviewScenarios[1]!;
}

export function renderEmailStudioPreview(
  template: EmailStudioTemplateDocument,
  values: Record<string, string>,
  theme: EmailStudioThemeDocument,
  senderName: string,
  replyToEmail: string,
  storeName: string
) {
  const rendered = renderEmailStudioTemplate(template, values, theme, storeName);
  return {
    subject: rendered.subject,
    preheader: rendered.preheader,
    body: rendered.text,
    html: rendered.html,
    from: (senderName.trim() || storeName.trim() || "Your store").trim(),
    replyTo: replyToEmail.trim() || values.replyToEmail || values.supportEmail || "",
    to: template.audience === "customer" ? values.customerEmail : "owner@store.test"
  };
}
