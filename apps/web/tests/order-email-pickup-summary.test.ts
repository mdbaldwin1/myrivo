import { describe, expect, it } from "vitest";
import { buildPickupSummaryText, resolveCustomerName, resolveEffectiveReplyTo } from "@/lib/notifications/order-emails";

describe("order email pickup summary", () => {
  it("includes pickup location and timezone-formatted pickup window", () => {
    const summary = buildPickupSummaryText({
      fulfillmentMethod: "pickup",
      pickupLocationSnapshot: {
        name: "Downtown Counter",
        addressLine1: "12 Main St",
        city: "Nashville",
        stateRegion: "TN",
        postalCode: "37201"
      },
      pickupWindowStartAt: "2030-06-01T14:00:00.000Z",
      pickupWindowEndAt: "2030-06-01T15:00:00.000Z",
      pickupTimezone: "America/Chicago"
    });

    expect(summary).toContain("Fulfillment: Pickup");
    expect(summary).toContain("Pickup Location: Downtown Counter");
    expect(summary).toContain("Address: 12 Main St, Nashville, TN, 37201");
    expect(summary).toContain("(America/Chicago)");
  });

  it("falls back to shipping summary when fulfillment is not pickup", () => {
    const summary = buildPickupSummaryText({
      fulfillmentMethod: "shipping",
      pickupLocationSnapshot: null,
      pickupWindowStartAt: null,
      pickupWindowEndAt: null,
      pickupTimezone: null
    });

    expect(summary).toBe("Fulfillment: Shipping");
  });

  it("uses 'To be confirmed' when pickup time is not set", () => {
    const summary = buildPickupSummaryText({
      fulfillmentMethod: "pickup",
      pickupLocationSnapshot: { name: "Front Desk" },
      pickupWindowStartAt: null,
      pickupWindowEndAt: null,
      pickupTimezone: "America/New_York"
    });

    expect(summary).toContain("Pickup Window: To be confirmed");
  });

  it("resolves customer name from first and last name", () => {
    const value = resolveCustomerName("Maya", "Rivera", "buyer@example.com");
    expect(value).toBe("Maya Rivera");
  });

  it("falls back to email prefix when customer name is missing", () => {
    const value = resolveCustomerName(null, null, "maker@example.com");
    expect(value).toBe("maker");
  });

  it("prioritizes configured reply-to over support and platform defaults", () => {
    expect(resolveEffectiveReplyTo("replies@brand.com", "support@shop.com", "ops@myrivo.app")).toBe("replies@brand.com");
  });

  it("falls back from reply-to to support email to platform reply-to", () => {
    expect(resolveEffectiveReplyTo(null, "support@shop.com", "ops@myrivo.app")).toBe("support@shop.com");
    expect(resolveEffectiveReplyTo("", "", "ops@myrivo.app")).toBe("ops@myrivo.app");
  });
});
