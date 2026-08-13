import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requirePlatformRoleMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args),
}));
vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ rpc: (...args: unknown[]) => rpcMock(...args) })),
}));

beforeEach(() => {
  requirePlatformRoleMock.mockReset();
  enforceTrustedOriginMock.mockReset().mockReturnValue(null);
  rpcMock.mockReset();
});

describe("platform digital product operations route", () => {
  test("requires the admin operator role for health data", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({ context: null, response: new Response(null, { status: 403 }) });
    const route = await import("@/app/api/platform/digital-products/operations/route");
    const response = await route.GET();
    expect(response.status).toBe(403);
    expect(requirePlatformRoleMock).toHaveBeenCalledWith("admin");
  });

  test("returns privacy-safe health issue fields", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({ context: { userId: crypto.randomUUID() }, response: null });
    rpcMock.mockResolvedValueOnce({ data: [{ issue_type: "paid_delivery_pending_over_5m", store_id: crypto.randomUUID(), order_id: crypto.randomUUID(), job_id: null, status: "missing", attempt_count: 0, repair_generation: 0, generation_attempt_count: 0, age_minutes: 8 }], error: null });
    const route = await import("@/app/api/platform/digital-products/operations/route");
    const payload = await (await route.GET()).json();
    expect(Object.keys(payload.issues[0]).sort()).toEqual(["ageMinutes", "attemptCount", "generationAttemptCount", "issueType", "jobId", "orderId", "repairGeneration", "status", "storeId"].sort());
  });

  test("dispatches an idempotent audited requeue RPC", async () => {
    const userId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    requirePlatformRoleMock.mockResolvedValueOnce({ context: { userId }, response: null });
    rpcMock.mockResolvedValueOnce({ data: "applied", error: null });
    const route = await import("@/app/api/platform/digital-products/operations/route");
    const response = await route.POST(new NextRequest("http://localhost/api/platform/digital-products/operations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "operator-request-123", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ action: "requeue", storeId, orderId }),
    }));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("requeue_digital_delivery", {
      p_store_id: storeId, p_order_id: orderId, p_actor_user_id: userId, p_idempotency_key: "operator-request-123",
    });
  });

  test("changes only the requested store rollout through the audited RPC", async () => {
    const userId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    requirePlatformRoleMock.mockResolvedValueOnce({ context: { userId }, response: null });
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const route = await import("@/app/api/platform/digital-products/operations/route");
    const response = await route.POST(new NextRequest("http://localhost/api/platform/digital-products/operations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "rollout-request-123", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ action: "rollout", storeId, enabled: true }),
    }));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("set_store_digital_products_enabled", {
      p_store_id: storeId, p_enabled: true, p_actor_user_id: userId, p_idempotency_key: "rollout-request-123",
    });
  });
});
