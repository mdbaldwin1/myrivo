import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthContext = {
  context: { globalRole: "admin" | "support" | "user"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthContext>>();
const enforceTrustedOriginMock = vi.fn<(request: NextRequest) => Response | null>();
const readJsonBodyMock = vi.fn();
const logAuditEventMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...(args as [NextRequest]))
}));

vi.mock("@/lib/http/read-json-body", () => ({
  readJsonBody: (...args: unknown[]) => readJsonBodyMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  readJsonBodyMock.mockReset();
  logAuditEventMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  readJsonBodyMock.mockResolvedValue({ ok: true, data: { billingPlanKey: "family_friends" } });
  requirePlatformRoleMock.mockResolvedValue({
    context: { globalRole: "admin", userId: "admin-1", storeId: "", storeSlug: "", storeRole: "customer" },
    response: null
  });
  logAuditEventMock.mockResolvedValue(undefined);
});

describe("platform store billing plan route", () => {
  test("updates a store billing plan and returns the new plan", async () => {
    const upsertMock = vi.fn(async () => ({ error: null }));

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", slug: "olive", name: "Olive Mercantile" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_billing_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  billing_plans: {
                    key: "standard",
                    name: "Standard",
                    transaction_fee_bps: 600,
                    transaction_fee_fixed_cents: 30
                  }
                },
                error: null
              }))
            }))
          })),
          upsert: upsertMock
        };
      }

      if (table === "billing_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "plan-family",
                    key: "family_friends",
                    name: "Family & Friends",
                    transaction_fee_bps: 300,
                    transaction_fee_fixed_cents: 30
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/stores/[storeId]/billing-plan/route");
    const request = new NextRequest("http://localhost:3000/api/platform/stores/store-1/billing-plan", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ billingPlanKey: "family_friends" })
    });

    const response = await route.PUT(request, { params: Promise.resolve({ storeId: "store-1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      billingPlan: { key: string; transaction_fee_bps: number; transaction_fee_fixed_cents: number };
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      billingPlan: {
        key: "family_friends",
        transaction_fee_bps: 300,
        transaction_fee_fixed_cents: 30
      }
    });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        store_id: "store-1",
        billing_plan_id: "plan-family"
      },
      { onConflict: "store_id" }
    );
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        metadata: expect.objectContaining({
          fromBillingPlanKey: "standard",
          toBillingPlanKey: "family_friends",
          source: "platform_store_billing_plan"
        })
      })
    );
  });

  test("rejects unsupported billing plans", async () => {
    readJsonBodyMock.mockResolvedValueOnce({ ok: true, data: { billingPlanKey: "starter" } });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", slug: "olive", name: "Olive Mercantile" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_billing_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { billing_plans: null },
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
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "plan-starter",
                    key: "starter",
                    name: "Starter",
                    transaction_fee_bps: 500,
                    transaction_fee_fixed_cents: 20
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/stores/[storeId]/billing-plan/route");
    const request = new NextRequest("http://localhost:3000/api/platform/stores/store-1/billing-plan", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ billingPlanKey: "starter" })
    });

    const response = await route.PUT(request, { params: Promise.resolve({ storeId: "store-1" }) });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Unsupported billing plan");
  });
});
