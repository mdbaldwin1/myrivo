import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const getOwnedStoreBundleForOptionalSlugMock = vi.fn();
const getOptionalStripePublishableKeyMock = vi.fn();
const accountsCreateMock = vi.fn();
const accountSessionsCreateMock = vi.fn();
const storesUpdateEqMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: (...args: unknown[]) => storesUpdateEqMock(...args)
      }))
    }))
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: (...args: unknown[]) => getOwnedStoreBundleForOptionalSlugMock(...args)
}));

vi.mock("@/lib/env", () => ({
  getOptionalStripePublishableKey: (...args: unknown[]) => getOptionalStripePublishableKeyMock(...args),
  isStripeStubMode: vi.fn(() => false),
  stripeEnvSchema: {
    safeParse: vi.fn(() => ({ success: true }))
  }
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: vi.fn(() => ({
    accounts: {
      create: (...args: unknown[]) => accountsCreateMock(...args)
    },
    accountSessions: {
      create: (...args: unknown[]) => accountSessionsCreateMock(...args)
    }
  }))
}));

describe("store payments connection session route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    getOwnedStoreBundleForOptionalSlugMock.mockReset();
    getOptionalStripePublishableKeyMock.mockReset();
    accountsCreateMock.mockReset();
    accountSessionsCreateMock.mockReset();
    storesUpdateEqMock.mockReset();

    getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "owner@example.com" }
      }
    });

    getOptionalStripePublishableKeyMock.mockReturnValue("pk_test_123");
    accountSessionsCreateMock.mockResolvedValue({
      client_secret: "sess_123_secret_abc"
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
  });

  test("creates an embedded connection session for an existing connected account", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        stripe_account_id: "acct_123"
      }
    });

    const route = await import("@/app/api/stores/payments/connection-session/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/payments/connection-session?storeSlug=test-store", {
        method: "POST"
      })
    );
    const payload = (await response.json()) as { publishableKey: string; clientSecret: string; accountId: string };

    expect(response.status).toBe(200);
    expect(accountSessionsCreateMock).toHaveBeenCalledWith({
      account: "acct_123",
      components: {
        account_onboarding: {
          enabled: true
        },
        notification_banner: {
          enabled: true
        }
      }
    });
    expect(payload).toEqual({
      publishableKey: "pk_test_123",
      clientSecret: "sess_123_secret_abc",
      accountId: "acct_123"
    });
  });

  test("creates the Stripe account first when the store is not connected yet", async () => {
    getOwnedStoreBundleForOptionalSlugMock.mockResolvedValue({
      store: {
        id: "store-1",
        stripe_account_id: null
      }
    });
    accountsCreateMock.mockResolvedValue({ id: "acct_new" });
    storesUpdateEqMock.mockReturnValue({
      eq: vi.fn(async () => ({
        error: null
      }))
    });

    const route = await import("@/app/api/stores/payments/connection-session/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/payments/connection-session?storeSlug=test-store", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(accountsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
        country: "US",
        email: "owner@example.com"
      })
    );
    expect(accountSessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acct_new"
      })
    );
  });
});
