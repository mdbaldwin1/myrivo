import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requireStorePermission: (...args: unknown[]) => requireStorePermissionMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

beforeEach(() => {
  requireStorePermissionMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStorePermissionMock.mockResolvedValue({
    context: { storeId: "store-1", globalRole: "admin", storeRole: "owner" },
    response: null
  });
});

describe("billing settings routes", () => {
  test("platform-config PUT returns 400 for malformed JSON", async () => {
    const route = await import("@/app/api/stores/platform-config/route");
    const request = new NextRequest("http://localhost:3000/api/stores/platform-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: "{"
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid JSON");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  test("platform-config PUT rejects billing plan assignment for non-admin users", async () => {
    requireStorePermissionMock.mockResolvedValueOnce({
      context: { storeId: "store-1", globalRole: "user", storeRole: "staff" },
      response: null
    });

    const route = await import("@/app/api/stores/platform-config/route");
    const request = new NextRequest("http://localhost:3000/api/stores/platform-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ billingPlanKey: "standard" })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("Only store admins");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  test("platform-config PUT allows store admins to assign the standard billing plan", async () => {
    requireStorePermissionMock.mockResolvedValueOnce({
      context: { storeId: "store-1", globalRole: "user", storeRole: "admin" },
      response: null
    });

    const maybeSinglePlanMock = vi.fn(async () => ({
      data: { id: "plan-standard", key: "standard" },
      error: null
    }));
    const billingUpsertMock = vi.fn(async () => ({ error: null }));

    serverFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "store-1" }, error: null }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected server table ${table}`);
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "billing_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: maybeSinglePlanMock
              })),
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "plan-standard",
                    key: "standard",
                    name: "Standard",
                    monthly_price_cents: 0,
                    transaction_fee_bps: 600,
                    transaction_fee_fixed_cents: 30,
                    active: true
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_billing_profiles") {
        return {
          upsert: billingUpsertMock,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  store_id: "store-1",
                  billing_plan_id: "plan-standard",
                  metadata_json: null,
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
          }))
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    });

    const route = await import("@/app/api/stores/platform-config/route");
    const request = new NextRequest("http://localhost:3000/api/stores/platform-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ billingPlanKey: "standard" })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { canManageBillingPlan: boolean };

    expect(response.status).toBe(200);
    expect(payload.canManageBillingPlan).toBe(true);
    expect(billingUpsertMock).toHaveBeenCalledWith(
      {
        store_id: "store-1",
        billing_plan_id: "plan-standard"
      },
      { onConflict: "store_id" }
    );
  });

  test("platform-config PUT still rejects family and friends assignment for non-platform-admin users", async () => {
    requireStorePermissionMock.mockResolvedValueOnce({
      context: { storeId: "store-1", globalRole: "user", storeRole: "admin" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "billing_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "plan-family", key: "family_friends" },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    });

    const route = await import("@/app/api/stores/platform-config/route");
    const request = new NextRequest("http://localhost:3000/api/stores/platform-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ billingPlanKey: "family_friends" })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("Only platform admins can assign the family & friends plan.");
  });

  test("white-label PUT returns 400 for malformed JSON", async () => {
    const route = await import("@/app/api/stores/white-label/route");
    const request = new NextRequest("http://localhost:3000/api/stores/white-label", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: "{"
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid JSON");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  test("white-label PUT updates store flag and returns enabled flag", async () => {
    const eqMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    serverFromMock.mockImplementation((table: string) => {
      if (table !== "stores") {
        throw new Error(`Unexpected table ${table}`);
      }
      return { update: updateMock };
    });

    const route = await import("@/app/api/stores/white-label/route");
    const request = new NextRequest("http://localhost:3000/api/stores/white-label", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ enabled: false })
    });

    const response = await route.PUT(request);
    const payload = (await response.json()) as { enabled: boolean };

    expect(response.status).toBe(200);
    expect(payload.enabled).toBe(false);
    expect(updateMock).toHaveBeenCalledWith({ white_label_enabled: false });
    expect(eqMock).toHaveBeenCalledWith("id", "store-1");
  });
});
