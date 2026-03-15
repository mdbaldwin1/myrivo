import { beforeEach, describe, expect, test, vi } from "vitest";

const sendTransactionalEmailMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/notifications/email-provider", () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmailMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: (...args: unknown[]) => createSupabaseAdminClientMock(...args)
}));

describe("welcome discount email", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://myrivo.local";
    process.env.MYRIVO_EMAIL_FROM = "hello@myrivo.local";
    process.env.MYRIVO_EMAIL_PLATFORM_FROM = "hello@myrivo.local";
    process.env.MYRIVO_EMAIL_REPLY_TO = "support@myrivo.local";
    sendTransactionalEmailMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, provider: "resend", error: null });
    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn(() => {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({
            data: {
              emails_json: {
                transactional: {
                  senderName: "Olive Mercantile Team",
                  replyToEmail: "support@olivemercantile.com",
                  templates: {
                    welcomeDiscount: {
                      subject: "Your code from {storeName}",
                      preheader: "Use {discountCode} on your next order.",
                      headline: "Welcome to {storeName}",
                      bodyHtml: "<p>Your code is <strong>{discountCode}</strong>.</p><p>Offer: {discountLabel}</p>",
                      ctaLabel: "Shop now",
                      ctaUrl: "{storeUrl}",
                      footerNote: "Unsubscribe: {unsubscribeUrl}"
                    }
                  }
                }
              }
            },
            error: null
          }))
        };
        return chain;
      })
    });
  });

  test("renders the welcome email from the Email Studio template document", async () => {
    const { sendWelcomeDiscountEmail } = await import("@/lib/marketing-email/welcome-discount");

    await sendWelcomeDiscountEmail({
      store: {
        id: "store-1",
        name: "Olive Mercantile",
        slug: "olive-mercantile"
      },
      settings: {
        support_email: "support@olivemercantile.com",
        seo_location_city: "Richmond",
        seo_location_region: null,
        seo_location_state: "VA",
        seo_location_postal_code: "23220",
        seo_location_country_code: "US",
        seo_location_address_line1: "12 Main Street",
        seo_location_address_line2: null,
        seo_location_show_full_address: false
      },
      promotion: {
        code: "WELCOME10",
        discount_type: "percent",
        discount_value: 10,
        min_subtotal_cents: 3500,
        ends_at: "2026-03-31T00:00:00.000Z"
      },
      recipientEmail: "shopper@example.com"
    });

    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your code from Olive Mercantile",
        to: ["shopper@example.com"],
        text: expect.stringContaining("WELCOME10"),
        html: expect.stringContaining("WELCOME10")
      })
    );
    expect(sendTransactionalEmailMock.mock.calls[0]?.[0]?.html).toContain("Welcome to Olive Mercantile");
  });
});
