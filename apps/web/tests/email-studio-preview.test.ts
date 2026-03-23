import { describe, expect, test } from "vitest";
import { buildDefaultEmailStudioDocument } from "@/lib/email-studio/model";
import {
  applyEmailStudioPreviewTemplate,
  renderEmailStudioPreview,
  resolveEmailStudioPreviewScenario
} from "@/lib/email-studio/preview";
import { renderEmailStudioTemplate } from "@/lib/email-studio/render";

describe("email studio preview helpers", () => {
  test("renders template strings against sample scenario values", () => {
    const scenario = resolveEmailStudioPreviewScenario("customerConfirmation", "pickup");
    const result = applyEmailStudioPreviewTemplate("Order {orderShortId} for {customerName}", scenario.values);

    expect(result).toContain("01HZX3K9");
    expect(result).toContain("Jordan Lee");
  });

  test("uses shipping sample data for shipping lifecycle templates", () => {
    const scenario = resolveEmailStudioPreviewScenario("shipped", "pickup");

    expect(scenario.id).toBe("shipping");
    expect(scenario.values.trackingUrl).toContain("tracking.example.com");
  });

  test("uses shipping sample data for shipping delay templates", () => {
    const scenario = resolveEmailStudioPreviewScenario("shippingDelay", "pickup");

    expect(scenario.id).toBe("shipping");
    expect(scenario.values.shippingDelayReason).toContain("Carrier");
  });

  test("uses welcome sample data for the welcome discount template", () => {
    const scenario = resolveEmailStudioPreviewScenario("welcomeDiscount", "pickup");

    expect(scenario.id).toBe("welcome");
    expect(scenario.values.discountCode).toBe("WELCOME10");
  });

  test("builds a preview envelope and rendered html/text from the active template", () => {
    const document = buildDefaultEmailStudioDocument("Olive Mercantile");
    const scenario = resolveEmailStudioPreviewScenario("delivered", "shipping");
    const preview = renderEmailStudioPreview(
      document.templates.delivered,
      scenario.values,
      document.theme,
      "Olive Mercantile",
      "support@olivemercantile.com",
      "Olive Mercantile"
    );

    expect(preview.from).toBe("Olive Mercantile");
    expect(preview.replyTo).toBe("support@olivemercantile.com");
    expect(preview.subject).toContain("01HZZ0KT");
    expect(preview.body).toContain("UPS");
    expect(preview.html).toContain("Your order was delivered");
  });

  test("renders pickup update previews with previous details and override reason", () => {
    const document = buildDefaultEmailStudioDocument("Olive Mercantile");
    const scenario = resolveEmailStudioPreviewScenario("pickupUpdated", "pickup");
    const preview = renderEmailStudioPreview(
      document.templates.pickupUpdated,
      scenario.values,
      document.theme,
      "Olive Mercantile",
      "support@olivemercantile.com",
      "Olive Mercantile"
    );

    expect(preview.html).toContain("Riverside porch");
    expect(preview.body).toContain("The original pickup window is no longer available.");
  });

  test("keeps pickup-oriented templates on the pickup scenario and shipping templates on the shipping scenario", () => {
    expect(resolveEmailStudioPreviewScenario("welcomeDiscount", "shipping").id).toBe("welcome");
    expect(resolveEmailStudioPreviewScenario("customerConfirmation", "shipping").id).toBe("pickup");
    expect(resolveEmailStudioPreviewScenario("ownerNewOrder", "shipping").id).toBe("pickup");
    expect(resolveEmailStudioPreviewScenario("pickupUpdated", "shipping").id).toBe("pickup");
    expect(resolveEmailStudioPreviewScenario("refundIssued", "shipping").id).toBe("pickup");
    expect(resolveEmailStudioPreviewScenario("shippingDelay", "pickup").id).toBe("shipping");
    expect(resolveEmailStudioPreviewScenario("shipped", "pickup").id).toBe("shipping");
    expect(resolveEmailStudioPreviewScenario("disputeOpened", "pickup").id).toBe("shipping");
    expect(resolveEmailStudioPreviewScenario("disputeResolved", "pickup").id).toBe("shipping");
    expect(resolveEmailStudioPreviewScenario("failed", "pickup").id).toBe("shipping");
    expect(resolveEmailStudioPreviewScenario("cancelled", "pickup").id).toBe("shipping");
    expect(resolveEmailStudioPreviewScenario("delivered", "pickup").id).toBe("shipping");
  });

  test("decodes leftover encoded apostrophes in stored template html before rendering", () => {
    const document = buildDefaultEmailStudioDocument("Olive Mercantile");
    const template = {
      ...document.templates.welcomeDiscount,
      bodyHtml: "<p>Use this code at checkout on {storeName}&amp;#39;s storefront.</p>"
    };

    const rendered = renderEmailStudioTemplate(
      template,
      {
        storeName: "Olive Mercantile"
      },
      document.theme,
      "Olive Mercantile"
    );

    expect(rendered.html).toContain("Olive Mercantile&#39;s storefront");
    expect(rendered.html).not.toContain("&amp;amp;#39;");
    expect(rendered.text).toContain("Olive Mercantile's storefront");
  });
});
