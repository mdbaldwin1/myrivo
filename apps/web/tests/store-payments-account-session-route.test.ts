import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const getOptionalStripePublishableKeyMock = vi.fn();
const accountSessionsCreateMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    }
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/env", () => ({
  getOptionalStripePublishableKey: (...args: unknown[]) => getOptionalStripePublishableKeyMock(...args)
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: vi.fn(() => ({
    accountSessions: {
      create: (...args: unknown[]) => accountSessionsCreateMock(...args)
    }
  }))
}));

describe("store payments account session route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    getOwnedStoreBundleForOptionalSlugMock.mockReset();
    getOptionalStripePublishableKeyMock.mockReset();
    accountSessionsCreateMock.mockReset();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" }
      }
    });

    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        stripe_account_id: "acct_123"
      }
    });

    getOptionalStripePublishableKeyMock.mockReturnValue("pk_test_123");
  });

  test("creates an account session for tax settings and registrations", async () => {
    accountSessionsCreateMock.mockResolvedValue({
      client_secret: "sess_123_secret_abc"
    });

    const route = await import("@/app/api/stores/payments/account-session/route");
    const response = await route.POST(new Request("http://localhost:3000/api/stores/payments/account-session?storeSlug=test-store", {
      method: "POST"
    }));
    const payload = (await response.json()) as { publishableKey: string; clientSecret: string };

    expect(response.status).toBe(200);
    expect(getOwnedStoreBundleForOptionalSlugMock).toHaveBeenCalledWith("user-1", "test-store", "admin");
    expect(accountSessionsCreateMock).toHaveBeenCalledWith({
      account: "acct_123",
      components: {
        tax_settings: { enabled: true },
        tax_registrations: { enabled: true }
      }
    });
    expect(payload).toEqual({
      publishableKey: "pk_test_123",
      clientSecret: "sess_123_secret_abc"
    });
  });

  test("returns 503 when the publishable key is missing", async () => {
    getOptionalStripePublishableKeyMock.mockReturnValue(null);

    const route = await import("@/app/api/stores/payments/account-session/route");
    const response = await route.POST(new Request("http://localhost:3000/api/stores/payments/account-session?storeSlug=test-store", {
      method: "POST"
    }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Missing Stripe publishable key configuration.");
    expect(accountSessionsCreateMock).not.toHaveBeenCalled();
  });
});
