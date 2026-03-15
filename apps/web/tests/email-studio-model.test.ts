import { describe, expect, test } from "vitest";
import {
  buildDefaultEmailStudioDocument,
  createEmailStudioDocumentFromSection,
  EMAIL_STUDIO_TOKENS,
  serializeEmailStudioDocument
} from "@/lib/email-studio/model";

describe("email studio model", () => {
  test("builds a complete default document for the current transactional templates", () => {
    const document = buildDefaultEmailStudioDocument("Olive Mercantile");

    expect(document.messageType).toBe("transactional");
    expect(document.senderName).toBe("");
    expect(document.replyToEmail).toBe("");
    expect(document.theme.accentColor).toBe("#7C5C3B");
    expect(document.templates.welcomeDiscount.messageType).toBe("marketing");
    expect(document.templates.welcomeDiscount.subject).toContain("Olive Mercantile");
    expect(document.templates.welcomeDiscount.bodyHtml).toContain("{discountCode}");
    expect(document.templates.customerConfirmation.subject).toContain("{orderShortId}");
    expect(document.templates.customerConfirmation.messageType).toBe("transactional");
    expect(document.templates.customerConfirmation.bodyHtml).toContain("{items}");
    expect(document.templates.pickupUpdated.bodyHtml).toContain("{previousPickupDetails}");
    expect(document.templates.shippingDelay.bodyHtml).toContain("{shippingDelayReason}");
    expect(document.templates.refundIssued.bodyHtml).toContain("{refundAmount}");
    expect(document.templates.disputeOpened.bodyHtml).toContain("{disputeReason}");
    expect(document.templates.disputeResolved.footerNote).toContain("{policiesUrl}");
    expect(document.templates.failed.headline).toContain("problem");
    expect(document.templates.shipped.ctaUrl).toContain("{trackingUrl}");
    expect(document.templates.delivered.footerNote).toContain("{replyToEmail}");
  });

  test("normalizes structured transactional content and falls back from legacy subject/body values", () => {
    const document = createEmailStudioDocumentFromSection(
      {
        transactional: {
          senderName: "Olive Mercantile",
          replyToEmail: "support@example.com",
          theme: {
            accentColor: "#112233",
            borderRadius: "pill"
          },
          templates: {
            customerConfirmation: {
              subject: "Thanks from {storeName}",
              preheader: "Preview text",
              headline: "Custom heading",
              bodyHtml: "<p>View order: {orderUrl}</p>",
              ctaLabel: "Check order",
              ctaUrl: "{orderUrl}",
              footerNote: "Reply to {replyToEmail}"
            }
          },
          shippedSubjectTemplate: "Legacy shipped subject",
          shippedBodyTemplate: "Legacy shipped body"
        }
      },
      "Olive Mercantile"
    );

    expect(document.senderName).toBe("Olive Mercantile");
    expect(document.messageType).toBe("transactional");
    expect(document.replyToEmail).toBe("support@example.com");
    expect(document.theme.accentColor).toBe("#112233");
    expect(document.theme.borderRadius).toBe("pill");
    expect(document.templates.customerConfirmation.subject).toBe("Thanks from {storeName}");
    expect(document.templates.customerConfirmation.bodyHtml).toContain("{orderUrl}");
    expect(document.templates.welcomeDiscount.subject).toContain("Olive Mercantile");
    expect(document.templates.shipped.subject).toBe("Legacy shipped subject");
    expect(document.templates.shipped.bodyHtml).toContain("Legacy shipped body");
  });

  test("serializes the structured document into transactional storage with legacy fallback fields", () => {
    const document = buildDefaultEmailStudioDocument("Olive Mercantile");
    document.senderName = "Olive Mercantile";
    document.replyToEmail = "support@example.com";
    document.theme.accentColor = "#123456";
    document.templates.welcomeDiscount.subject = "Your code from {storeName}";
    document.templates.welcomeDiscount.bodyHtml = "<p>Use {discountCode}</p>";
    document.templates.customerConfirmation.subject = "A";
    document.templates.customerConfirmation.bodyHtml = "<p>B</p>";
    document.templates.pickupUpdated.subject = "C";
    document.templates.pickupUpdated.bodyHtml = "<p>D</p>";
    document.templates.refundIssued.subject = "E";
    document.templates.refundIssued.bodyHtml = "<p>F</p>";

    const serialized = serializeEmailStudioDocument(document);
    const transactional = serialized.transactional as Record<string, unknown>;
    const templates = transactional.templates as Record<string, Record<string, string>>;

    expect(transactional.senderName).toBe("Olive Mercantile");
    expect((transactional.theme as Record<string, string>).accentColor).toBe("#123456");
    expect(templates.welcomeDiscount?.subject).toBe("Your code from {storeName}");
    expect(templates.welcomeDiscount?.bodyHtml).toBe("<p>Use {discountCode}</p>");
    expect(templates.customerConfirmation?.subject).toBe("A");
    expect(templates.customerConfirmation?.bodyHtml).toBe("<p>B</p>");
    expect(templates.pickupUpdated?.subject).toBe("C");
    expect(templates.pickupUpdated?.bodyHtml).toBe("<p>D</p>");
    expect(templates.refundIssued?.subject).toBe("E");
    expect(templates.refundIssued?.bodyHtml).toBe("<p>F</p>");
    expect(transactional.customerConfirmationBodyTemplate).toBe("B");
    expect(transactional.pickupUpdatedBodyTemplate).toBe("D");
    expect(transactional.refundIssuedBodyTemplate).toBe("F");
  });

  test("keeps token metadata centralized for the Email Studio UI", () => {
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{replyToEmail}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{pickupDetails}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{previousPickupDetails}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{pickupUpdateReason}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{trackingUrl}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{shippingDelayReason}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{revisedShipDate}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{policiesUrl}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{refundAmount}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{disputeStatus}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{discountCode}")).toBe(true);
    expect(EMAIL_STUDIO_TOKENS.some((token) => token.token === "{unsubscribeUrl}")).toBe(true);
  });
});
