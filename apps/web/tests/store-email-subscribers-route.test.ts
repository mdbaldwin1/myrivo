import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getOwnedStoreBundleForOptionalSlugMock = vi.fn();

let authGetUserMock: ReturnType<typeof vi.fn>;
let supabaseFromMock: ReturnType<typeof vi.fn>;
let adminSupabaseFromMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    },
    from: (...args: unknown[]) => supabaseFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminSupabaseFromMock(...args)
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/notifications/sender", () => ({
  resolvePlatformNotificationFromAddress: () => "no-reply@myrivo.app"
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  authGetUserMock = vi.fn(async () => ({ data: { user: { id: "user-1" } } }));
  getOwnedStoreBundleForOptionalSlugMock.mockReset();
  getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
    store: { id: "store-1", slug: "apothecary", name: "Apothecary" },
    settings: {
      support_email: "support@apothecary.test",
      seo_location_city: "Albany",
      seo_location_region: null,
      seo_location_state: "NY",
      seo_location_postal_code: "12203",
      seo_location_country_code: "US",
      seo_location_address_line1: "1 Madison Ave",
      seo_location_address_line2: null,
      seo_location_show_full_address: true
    }
  });
  supabaseFromMock = vi.fn((table: string) => {
    if (table !== "store_email_subscribers") {
      throw new Error(`Unexpected table ${table}`);
    }

    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(async () => ({
        data: [
          {
            id: "subscriber-1",
            email: "shopper@example.com",
            status: "subscribed",
            source: "newsletter_footer",
            metadata_json: {
              consent_source: "storefront_footer",
              consent_location: "/s/apothecary",
              consent_captured_at: "2026-03-13T00:00:00.000Z",
              suppression_reason: null
            },
            subscribed_at: "2026-03-13T00:00:00.000Z",
            unsubscribed_at: null,
            created_at: "2026-03-13T00:00:00.000Z"
          }
        ],
        error: null
      }))
    };

    return chain;
  });
  adminSupabaseFromMock = supabaseFromMock;
});

describe("store email subscribers route", () => {
  test("returns subscribers tagged as marketing message type", async () => {
    const { GET } = await import("@/app/api/stores/email-subscribers/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/stores/email-subscribers"));
    const payload = (await response.json()) as {
      subscribers: Array<{ email: string; message_type: string; consent_source: string }>;
      summary: { messageType: string };
      compliance: { replyToEmail: string | null; footerAddress: string | null; readiness: { status: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.subscribers[0]).toMatchObject({
      email: "shopper@example.com",
      message_type: "marketing",
      consent_source: "storefront_footer"
    });
    expect(payload.summary.messageType).toBe("marketing");
    expect(payload.compliance).toMatchObject({
      replyToEmail: "support@apothecary.test",
      readiness: { status: "ready" }
    });
    expect(payload.compliance.footerAddress).toContain("1 Madison Ave");
  });

  test("includes message type in CSV export", async () => {
    const { GET } = await import("@/app/api/stores/email-subscribers/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/stores/email-subscribers?format=csv"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("message_type");
    expect(body).toContain("\"marketing\"");
  });
});
