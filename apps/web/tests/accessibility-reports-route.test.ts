import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const logAuditEventMock = vi.fn();

let insertedPayload: Record<string, unknown> | null = null;

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "accessibility_reports") {
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "report-1", priority: "high" }, error: null }))
            }))
          };
        })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  })
};

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => supabaseMock)
}));

beforeEach(() => {
  insertedPayload = null;
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  logAuditEventMock.mockReset();
  supabaseMock.from.mockClear();
  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
});

describe("accessibility reports route", () => {
  test("submits a public accessibility report", async () => {
    const { POST } = await import("@/app/api/accessibility/reports/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/accessibility/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000",
          referer: "http://localhost:3000/checkout"
        },
        body: JSON.stringify({
          reporterName: "Shopper",
          reporterEmail: "Shopper@example.com",
          featureArea: "checkout",
          issueSummary: "Keyboard trap in shipping form",
          actualBehavior: "Focus gets stuck in the shipping section.",
          blocksCriticalFlow: true
        })
      })
    );

    expect(response.status).toBe(200);
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        reporter_name: "Shopper",
        reporter_email: "shopper@example.com",
        feature_area: "checkout",
        priority: "high",
        blocks_critical_flow: true,
        source: "public_form"
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
