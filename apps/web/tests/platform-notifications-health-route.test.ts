import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

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

describe("platform notifications health route", () => {
  test("returns role error response when unauthorized", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/notifications/health/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/api/platform/notifications/health"));

    expect(response.status).toBe(403);
  });

  test("returns summary metrics and failures", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "notifications") {
        return {
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      {
                        id: "n1",
                        event_type: "order.created.owner",
                        status: "sent",
                        recipient_email: "owner@example.com",
                        created_at: "2026-03-01T00:00:00.000Z",
                        sent_at: "2026-03-01T00:00:05.000Z",
                        channel_targets: { email: true, inApp: true }
                      },
                      {
                        id: "n2",
                        event_type: "system.setup.warning",
                        status: "failed",
                        recipient_email: "owner@example.com",
                        created_at: "2026-03-02T00:00:00.000Z",
                        sent_at: null,
                        channel_targets: { email: true, inApp: true }
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "notification_delivery_attempts") {
        return {
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      {
                        notification_id: "n1",
                        channel: "email",
                        status: "sent",
                        error: null,
                        created_at: "2026-03-01T00:00:05.000Z"
                      },
                      {
                        notification_id: "n2",
                        channel: "email",
                        status: "failed",
                        error: "temporary 500",
                        created_at: "2026-03-02T00:00:10.000Z"
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/platform/notifications/health/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/api/platform/notifications/health"));
    const payload = (await response.json()) as {
      summary: { notificationsTotal: number; emailSuccessRate: number; avgSendLatencySeconds: number };
      byEventType: Array<{ eventType: string; total: number }>;
      recentFailures: Array<{ notificationId: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.summary.notificationsTotal).toBe(2);
    expect(payload.summary.emailSuccessRate).toBe(50);
    expect(payload.summary.avgSendLatencySeconds).toBe(5);
    expect(payload.byEventType[0]?.eventType).toBe("order.created.owner");
    expect(payload.recentFailures[0]?.notificationId).toBe("n2");
  });
});
