import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const sendWelcomeDiscountEmailMock = vi.fn();
const popupPromotionId = "11111111-1111-4111-8111-111111111111";

let insertedPayload: Record<string, unknown> | null = null;
let updatedPayload: Record<string, unknown> | null = null;
let subscriberLookupMode: "subscribe" | "unsubscribe" = "subscribe";
let settingsMode: "footer" | "welcomePopup" = "footer";
let promotionLookupMode: "active" | "inactive" = "active";

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "stores") {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: { id: "store-1", name: "At Home Apothecary", slug: "at-home-apothecary", status: "active" },
          error: null
        }))
      };
      return chain;
    }

    if (table === "store_settings") {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data:
            settingsMode === "welcomePopup"
              ? {
                  email_capture_enabled: true,
                  welcome_popup_enabled: true,
                  welcome_popup_promotion_id: popupPromotionId,
                  support_email: "support@example.com",
                  seo_location_city: "Richmond",
                  seo_location_region: null,
                  seo_location_state: "VA",
                  seo_location_postal_code: "23220",
                  seo_location_country_code: "US",
                  seo_location_address_line1: "12 Main Street",
                  seo_location_address_line2: null,
                  seo_location_show_full_address: false
                }
              : { email_capture_enabled: true },
          error: null
        }))
      };
      return chain;
    }

    if (table === "promotions") {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data:
            promotionLookupMode === "active"
              ? {
                  id: popupPromotionId,
                  code: "WELCOME10",
                  discount_type: "percent",
                  discount_value: 10,
                  min_subtotal_cents: 0,
                  max_redemptions: null,
                  times_redeemed: 0,
                  starts_at: null,
                  ends_at: null,
                  is_active: true
                }
              : {
                  id: popupPromotionId,
                  code: "WELCOME10",
                  discount_type: "percent",
                  discount_value: 10,
                  min_subtotal_cents: 0,
                  max_redemptions: null,
                  times_redeemed: 0,
                  starts_at: null,
                  ends_at: null,
                  is_active: false
                },
          error: null
        }))
      };
      return chain;
    }

    if (table === "store_email_subscribers") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data:
                  subscriberLookupMode === "unsubscribe"
                    ? { id: "subscriber-1", status: "subscribed", metadata_json: {} }
                    : settingsMode === "welcomePopup" && subscriberLookupMode === "subscribe"
                      ? null
                    : null,
                error: null
              }))
            }))
          }))
        })),
        insert: vi.fn(async (payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return { error: null };
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatedPayload = payload;
          const chain = {
            eq: vi.fn(() => chain)
          };
          return chain;
        })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  })
};

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/marketing-email/welcome-discount", () => ({
  sendWelcomeDiscountEmail: (...args: unknown[]) => sendWelcomeDiscountEmailMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => supabaseMock)
}));

beforeEach(() => {
  insertedPayload = null;
  updatedPayload = null;
  subscriberLookupMode = "subscribe";
  settingsMode = "footer";
  promotionLookupMode = "active";
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  sendWelcomeDiscountEmailMock.mockReset();
  supabaseMock.from.mockClear();
  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("at-home-apothecary");
  sendWelcomeDiscountEmailMock.mockResolvedValue({ ok: true, provider: "resend", error: null });
});

describe("storefront newsletter routes", () => {
  test("stores consent metadata when subscribing", async () => {
    const { POST } = await import("@/app/api/storefront/newsletter/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/newsletter?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          source: "storefront_footer",
          location: "/s/at-home-apothecary"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        source: "storefront_footer",
        metadata_json: expect.objectContaining({
          consent_source: "storefront_footer",
          consent_location: "/s/at-home-apothecary",
          suppression_reason: null
        })
      })
    );
  });

  test("stores suppression metadata when unsubscribing", async () => {
    subscriberLookupMode = "unsubscribe";

    const { POST } = await import("@/app/api/storefront/newsletter/unsubscribe/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/newsletter/unsubscribe?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          source: "unsubscribe_form"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(updatedPayload).toEqual(
      expect.objectContaining({
        status: "unsubscribed",
        metadata_json: expect.objectContaining({
          suppression_reason: "user_unsubscribed",
          suppression_source: "unsubscribe_form"
        })
      })
    );
  });

  test("sends the welcome discount email for popup signups", async () => {
    settingsMode = "welcomePopup";

    const { POST } = await import("@/app/api/storefront/newsletter/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/newsletter?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          source: "storefront_welcome_popup",
          location: "/s/at-home-apothecary",
          welcomePopupPromotionId: popupPromotionId,
          welcomePopupCampaignKey: `${popupPromotionId}:campaign`
        })
      })
    );

    expect(response.status).toBe(200);
    expect(sendWelcomeDiscountEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "shopper@example.com",
        store: expect.objectContaining({ slug: "at-home-apothecary" }),
        promotion: expect.objectContaining({ code: "WELCOME10" })
      })
    );
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        source: "storefront_welcome_popup",
        metadata_json: expect.objectContaining({
          welcome_popup_campaign_key: `${popupPromotionId}:campaign`,
          welcome_popup_promotion_id: popupPromotionId
        })
      })
    );
  });

  test("rejects popup signups when the active welcome promo is unavailable", async () => {
    settingsMode = "welcomePopup";
    promotionLookupMode = "inactive";

    const { POST } = await import("@/app/api/storefront/newsletter/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/newsletter?store=at-home-apothecary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          source: "storefront_welcome_popup",
          location: "/s/at-home-apothecary",
          welcomePopupPromotionId: popupPromotionId
        })
      })
    );

    expect(response.status).toBe(400);
    expect(sendWelcomeDiscountEmailMock).not.toHaveBeenCalled();
  });
});
