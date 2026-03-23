import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type AuthContext = {
  context: { globalRole: "admin" | "support" | "user"; userId: string; storeId: string; storeSlug: string; storeRole: "customer" };
  response: Response | null;
};

const requirePlatformRoleMock = vi.fn<(...args: unknown[]) => Promise<AuthContext>>();
const adminFromMock = vi.fn();
const logAuditEventMock = vi.fn();
let updatePayload: Record<string, unknown> | null = null;

vi.mock("@/lib/auth/authorization", () => ({
  requirePlatformRole: (...args: unknown[]) => requirePlatformRoleMock(...args)
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
  adminFromMock.mockReset();
  logAuditEventMock.mockReset();
  updatePayload = null;
});

describe("platform accessibility reports route", () => {
  test("returns 403 when role is not allowed", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "user", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: new Response(JSON.stringify({ error: "Insufficient platform role" }), { status: 403 })
    });

    const route = await import("@/app/api/platform/accessibility/reports/route");
    const response = await route.GET();
    expect(response.status).toBe(403);
  });

  test("returns the accessibility queue summary", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    let selectCallCount = 0;

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "accessibility_reports") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn((columns?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            selectCallCount += 1;
            if (selectCallCount === 1) {
              return Promise.resolve({ count: 4, error: null });
            }
            if (selectCallCount === 2) {
              return {
                in: vi.fn(async () => ({ count: 3, error: null }))
              };
            }
            return {
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({ count: 1, error: null }))
              }))
            };
          }

          return {
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      id: "report-1",
                      reporter_name: "Shopper",
                      reporter_email: "shopper@example.com",
                      page_url: "/checkout",
                      feature_area: "checkout",
                      issue_summary: "Keyboard trap",
                      expected_behavior: null,
                      actual_behavior: "Focus loops",
                      assistive_technology: "VoiceOver",
                      browser: "Safari",
                      device: "iPhone",
                      blocks_critical_flow: true,
                      status: "new",
                      priority: "high",
                      owner_notes: null,
                      remediation_notes: null,
                      source: "public_form",
                      triaged_at: null,
                      resolved_at: null,
                      resolved_by_user_id: null,
                      metadata_json: {},
                      created_at: "2026-03-14T00:00:00Z",
                      updated_at: "2026-03-14T00:00:00Z"
                    }
                  ],
                  error: null
                }))
              }))
            }))
          };
        })
      };
    });

    const route = await import("@/app/api/platform/accessibility/reports/route");
    const response = await route.GET();
    const payload = (await response.json()) as { summary: { totalCount: number; openCount: number; criticalOpenCount: number }; reports: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.summary).toEqual({ totalCount: 4, openCount: 3, criticalOpenCount: 1 });
    expect(payload.reports[0]?.id).toBe("report-1");
  });

  test("updates a report status and priority", async () => {
    requirePlatformRoleMock.mockResolvedValueOnce({
      context: { globalRole: "support", userId: "u1", storeId: "", storeSlug: "", storeRole: "customer" },
      response: null
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "accessibility_reports") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "0ff4932e-8263-4456-bf34-6db55cc4dd7a",
                    reporter_name: "Shopper",
                    reporter_email: "shopper@example.com",
                    page_url: "/checkout",
                    feature_area: "checkout",
                    issue_summary: "Keyboard trap",
                    expected_behavior: null,
                    actual_behavior: "Focus loops",
                    assistive_technology: null,
                    browser: null,
                    device: null,
                    blocks_critical_flow: true,
                    status: "resolved",
                    priority: "critical",
                    owner_notes: "Confirmed",
                    remediation_notes: "Patched",
                    source: "public_form",
                    triaged_at: null,
                    resolved_at: "2026-03-14T01:00:00Z",
                    resolved_by_user_id: "u1",
                    metadata_json: {},
                    created_at: "2026-03-14T00:00:00Z",
                    updated_at: "2026-03-14T01:00:00Z"
                  },
                  error: null
                }))
              }))
            }))
          };
        })
      };
    });

    const route = await import("@/app/api/platform/accessibility/reports/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/platform/accessibility/reports", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reportId: "0ff4932e-8263-4456-bf34-6db55cc4dd7a",
          status: "resolved",
          priority: "critical",
          ownerNotes: "Confirmed",
          remediationNotes: "Patched"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual(
      expect.objectContaining({
        status: "resolved",
        priority: "critical",
        owner_notes: "Confirmed",
        remediation_notes: "Patched",
        resolved_by_user_id: "u1"
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
