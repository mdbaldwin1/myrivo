import { describe, expect, test } from "vitest";
import {
  sanitizeStorefrontAnalyticsEventValue,
  sanitizeStorefrontAttributionSnapshot,
  sanitizeStorefrontSessionContext
} from "@/lib/analytics/governance";

describe("analytics governance", () => {
  test("strips non-marketing query params and local referrers from session context", () => {
    const sanitized = sanitizeStorefrontSessionContext({
      entryPath: "/products/body-oil?utm_source=instagram&email=test@example.com",
      referrer: "https://google.com/search?q=body+oil&utm_term=ignored",
      userAgent: "Mozilla/5.0",
      storeSlug: "at-home-apothecary"
    });

    expect(sanitized.entryPath).toBe("/products/body-oil?utm_source=instagram");
    expect(sanitized.referrer).toBe("https://google.com/search");
    expect(sanitized.userAgent).toBe("Mozilla/5.0");
  });

  test("redacts search queries that look like pii", () => {
    const sanitized = sanitizeStorefrontAnalyticsEventValue({
      eventType: "search_performed",
      value: {
        query: "mike@example.com",
        resultCount: 7,
        filters: { scent: ["lavender"] }
      }
    });

    expect(sanitized).toMatchObject({
      resultCount: 7,
      queryRedacted: true
    });
    expect("query" in sanitized).toBe(false);
    expect("filters" in sanitized).toBe(false);
  });

  test("keeps only allowlisted analytics fields per event type", () => {
    const sanitized = sanitizeStorefrontAnalyticsEventValue({
      eventType: "checkout_started",
      value: {
        itemCount: 2,
        subtotalCents: 4500,
        totalCents: 4900,
        fulfillmentMethod: "pickup",
        productIds: ["prod-1", "prod-2"],
        customerEmail: "test@example.com"
      }
    });

    expect(sanitized).toMatchObject({
      itemCount: 2,
      subtotalCents: 4500,
      totalCents: 4900,
      fulfillmentMethod: "pickup"
    });
    expect("productIds" in sanitized).toBe(false);
    expect("customerEmail" in sanitized).toBe(false);
  });

  test("sanitizes attribution snapshots consistently", () => {
    const snapshot = sanitizeStorefrontAttributionSnapshot(
      {
        firstTouch: {
          entryPath: "/s/at-home-apothecary?utm_source=instagram&coupon=secret",
          referrerUrl: "https://pinterest.com/pin/123?email=test@example.com",
          utmSource: "instagram"
        }
      },
      "at-home-apothecary"
    );

    expect(snapshot?.firstTouch?.entryPath).toBe("/s/at-home-apothecary?utm_source=instagram");
    expect(snapshot?.firstTouch?.referrerUrl).toBe("https://pinterest.com/pin/123");
  });
});
