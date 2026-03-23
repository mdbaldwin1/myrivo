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

function buildTableQuery(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          returns: vi.fn(async () => ({ data, error }))
        }))
      })),
      in: vi.fn(() => ({
        returns: vi.fn(async () => ({ data, error }))
      })),
      returns: vi.fn(async () => ({ data, error }))
    }))
  };
}

function buildCountQuery(count: number, error: { message: string } | null = null) {
  const result = { count, error };
  return {
    select: vi.fn(() => ({
      eq: vi.fn(async () => result),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result))
    }))
  };
}

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  adminFromMock.mockReset();
});

describe("platform stores route", () => {
  test("returns 403 when platform access is denied", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/stores/route");
    const response = await route.GET();
    expect(response.status).toBe(403);
  });

  test("returns store directory data with owner and membership context", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    let storesCallCount = 0;

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        storesCallCount += 1;
        if (storesCallCount === 1) {
          return buildTableQuery([
            {
              id: "store-1",
              owner_user_id: "owner-1",
              name: "Olive Mercantile",
              slug: "olive",
              status: "live",
              white_label_enabled: true,
              stripe_account_id: "acct_123",
              created_at: "2026-01-01T00:00:00Z"
            },
            {
              id: "store-2",
              owner_user_id: "owner-2",
              name: "Paper Hearth",
              slug: "paper",
              status: "pending_review",
              white_label_enabled: false,
              stripe_account_id: null,
              created_at: "2026-01-02T00:00:00Z"
            }
          ]);
        }
        if (storesCallCount === 2) {
          return buildCountQuery(2);
        }
        if (storesCallCount === 3) {
          return buildCountQuery(1);
        }
        if (storesCallCount === 4) {
          return buildCountQuery(1);
        }
        if (storesCallCount === 5) {
          return buildCountQuery(0);
        }
        if (storesCallCount === 6) {
          return buildCountQuery(0);
        }
      }

      if (table === "user_profiles") {
        return buildTableQuery([
          { id: "owner-1", email: "owner1@example.com", display_name: "Owner One" },
          { id: "owner-2", email: "owner2@example.com", display_name: "Owner Two" }
        ]);
      }

      if (table === "store_memberships") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  { store_id: "store-1", status: "active" },
                  { store_id: "store-1", status: "active" },
                  { store_id: "store-2", status: "invited" }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_billing_profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  {
                    store_id: "store-1",
                    billing_plan_id: "plan-family",
                    billing_plans: {
                      key: "family_friends",
                      name: "Family & Friends",
                      transaction_fee_bps: 300,
                      transaction_fee_fixed_cents: 30
                    }
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "billing_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      id: "plan-standard",
                      key: "standard",
                      name: "Standard",
                      monthly_price_cents: 0,
                      transaction_fee_bps: 600,
                      transaction_fee_fixed_cents: 30,
                      active: true
                    },
                    {
                      id: "plan-family",
                      key: "family_friends",
                      name: "Family & Friends",
                      monthly_price_cents: 0,
                      transaction_fee_bps: 300,
                      transaction_fee_fixed_cents: 30,
                      active: true
                    }
                  ],
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/stores/route");
    const response = await route.GET();
    const payload = (await response.json()) as {
      summary: { storesTotal: number; liveStoresCount: number; pendingStoresCount: number };
      plans: Array<{ key: string; monthly_price_cents: number }>;
      stores: Array<{
        id: string;
        activeMemberCount: number;
        billingPlan: { key: string; transaction_fee_bps: number; transaction_fee_fixed_cents: number } | null;
        owner: { display_name: string | null };
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.summary.storesTotal).toBe(2);
    expect(payload.summary.liveStoresCount).toBe(1);
    expect(payload.summary.pendingStoresCount).toBe(1);
    expect(payload.plans).toHaveLength(2);
    expect(payload.stores).toHaveLength(2);
    expect(payload.stores[0]).toMatchObject({
      id: "store-1",
      activeMemberCount: 2,
      billingPlan: {
        key: "family_friends",
        transaction_fee_bps: 300,
        transaction_fee_fixed_cents: 30
      },
      owner: { display_name: "Owner One" }
    });
    expect(payload.stores[1]).toMatchObject({
      id: "store-2",
      activeMemberCount: 0,
      billingPlan: {
        key: "standard",
        transaction_fee_bps: 600,
        transaction_fee_fixed_cents: 30
      },
      owner: { display_name: "Owner Two" }
    });
  });
});
