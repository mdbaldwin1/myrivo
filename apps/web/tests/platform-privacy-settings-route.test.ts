import { beforeEach, describe, expect, test, vi } from "vitest";

type AuthorizationMock = {
  context: { globalRole: "user" | "support" | "admin"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthorizationMock>>();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  adminFromMock.mockReset();
});

describe("platform privacy settings route", () => {
  test("returns platform storefront privacy settings for support roles", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "platform_storefront_privacy_settings") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                key: "default",
                notice_at_collection_enabled: true,
                checkout_notice_enabled: true,
                newsletter_notice_enabled: false,
                review_notice_enabled: true,
                show_california_notice: true,
                show_do_not_sell_link: false,
                created_at: "2026-03-17T00:00:00Z",
                updated_at: "2026-03-17T00:00:00Z"
              },
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/platform/privacy-settings/route");
    const response = await route.GET();
    const payload = (await response.json()) as {
      role: "support";
      settings: {
        newsletter_notice_enabled: boolean;
        show_california_notice: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.role).toBe("support");
    expect(payload.settings.newsletter_notice_enabled).toBe(false);
    expect(payload.settings.show_california_notice).toBe(true);
  });

  test("updates platform storefront privacy settings for admins", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "admin", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    const upsertMock = vi.fn(async () => ({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "platform_storefront_privacy_settings") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        upsert: upsertMock
      };
    });

    const route = await import("@/app/api/platform/privacy-settings/route");
    const request = new Request("http://localhost/api/platform/privacy-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notice_at_collection_enabled: true,
        checkout_notice_enabled: false,
        newsletter_notice_enabled: false,
        review_notice_enabled: true,
        show_california_notice: true,
        show_do_not_sell_link: true
      })
    });
    const response = await route.PUT(request);
    const payload = (await response.json()) as {
      role: "admin";
      settings: {
        checkout_notice_enabled: boolean;
        show_do_not_sell_link: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "default",
        checkout_notice_enabled: false,
        show_do_not_sell_link: true
      }),
      { onConflict: "key" }
    );
    expect(payload.role).toBe("admin");
    expect(payload.settings.checkout_notice_enabled).toBe(false);
    expect(payload.settings.show_do_not_sell_link).toBe(true);
  });
});
