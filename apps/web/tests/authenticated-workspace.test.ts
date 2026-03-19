import { beforeEach, describe, expect, test, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (...args: unknown[]) => fromMock(...args)
  }))
}));

function countResult(count: number, error: { message: string } | null = null) {
  return Promise.resolve({ count, error });
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("resolveAuthenticatedWorkspacePath", () => {
  test("sends net-new users to the welcome chooser", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { email: "shopper@example.com", metadata: {} },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "customer_carts" || table === "orders" || table === "customer_saved_stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => countResult(0))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { resolveAuthenticatedWorkspacePath } = await import("@/lib/auth/authenticated-workspace");
    await expect(resolveAuthenticatedWorkspacePath("user-1")).resolves.toBe("/dashboard/welcome");
  });

  test("sends seller-intent users without a store into onboarding", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { email: "seller@example.com", metadata: { welcome_intent: "sell" } },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { resolveAuthenticatedWorkspacePath } = await import("@/lib/auth/authenticated-workspace");
    await expect(resolveAuthenticatedWorkspacePath("user-1")).resolves.toBe("/dashboard/stores/onboarding/new");
  });
});
