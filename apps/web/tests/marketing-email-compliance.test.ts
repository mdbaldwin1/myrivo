import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/notifications/sender", () => ({
  resolvePlatformNotificationFromAddress: () => "no-reply@myrivo.app"
}));

describe("resolveMarketingEmailComplianceDefaults", () => {
  test("returns ready defaults when support email and mailing address are configured", async () => {
    const { resolveMarketingEmailComplianceDefaults } = await import("@/lib/marketing-email/compliance");

    const resolved = resolveMarketingEmailComplianceDefaults(
      { name: "Sunset Mercantile", slug: "sunset-mercantile" },
      {
        support_email: "support@athomeapothecary.com",
        seo_location_city: "Albany",
        seo_location_region: null,
        seo_location_state: "NY",
        seo_location_postal_code: "12203",
        seo_location_country_code: "US",
        seo_location_address_line1: "1 Madison Ave",
        seo_location_address_line2: "Suite 2",
        seo_location_show_full_address: true
      }
    );

    expect(resolved).toMatchObject({
      messageType: "marketing",
      fromAddress: "no-reply@myrivo.app",
      fromMode: "platform_sender",
      senderDisplayName: "Sunset Mercantile",
      replyToEmail: "support@athomeapothecary.com",
      unsubscribeHref: "/unsubscribe?store=at-home-apothecary",
      privacyPolicyHref: "/s/at-home-apothecary/privacy",
      readiness: {
        status: "ready"
      }
    });
    expect(resolved.footerAddress).toContain("1 Madison Ave");
    expect(resolved.readiness.warnings).toEqual([]);
  });

  test("flags missing support email and mailing address", async () => {
    const { resolveMarketingEmailComplianceDefaults } = await import("@/lib/marketing-email/compliance");

    const resolved = resolveMarketingEmailComplianceDefaults({ name: "Sunset Mercantile", slug: "sunset-mercantile" }, null);

    expect(resolved.replyToEmail).toBeNull();
    expect(resolved.footerAddress).toBeNull();
    expect(resolved.readiness.status).toBe("attention_required");
    expect(resolved.readiness.warnings).toHaveLength(2);
  });
});
