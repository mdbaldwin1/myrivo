import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStoreRoleMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();
const resolveTxtMock = vi.fn();
const provisionVercelProjectDomainMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  resolveTxt: (...args: unknown[]) => resolveTxtMock(...args)
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStoreRole: (...args: unknown[]) => requireStoreRoleMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/vercel/domains", () => ({
  provisionVercelProjectDomain: (...args: unknown[]) => provisionVercelProjectDomainMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  requireStoreRoleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();
  resolveTxtMock.mockReset();
  provisionVercelProjectDomainMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStoreRoleMock.mockResolvedValue({
    context: { storeId: "store-1", userId: "user-1", storeRole: "admin", globalRole: "user", storeSlug: "curby" },
    response: null
  });
});

describe("store domains verify route", () => {
  test("writes provisioning-ready status when domain verifies and Vercel provisioning succeeds", async () => {
    const domainRecord = {
      id: "domain-1",
      store_id: "store-1",
      domain: "shop.example.com",
      is_primary: true,
      verification_status: "verified",
      verification_token: "myrivo-token",
      last_verification_at: "2026-03-01T00:00:00.000Z",
      verified_at: "2026-03-01T00:00:00.000Z",
      hosting_provider: "vercel",
      hosting_status: "ready",
      hosting_last_checked_at: "2026-03-01T00:00:00.000Z",
      hosting_ready_at: "2026-03-01T00:00:00.000Z",
      hosting_error: null,
      hosting_metadata_json: {},
      created_at: "2026-03-01T00:00:00.000Z"
    };

    resolveTxtMock.mockResolvedValue([[domainRecord.verification_token]]);
    provisionVercelProjectDomainMock.mockResolvedValue({
      status: "ready",
      metadata: { example: true },
      error: null
    });

    serverFromMock.mockImplementation((table: string) => {
      if (table === "store_domains") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: domainRecord, error: null }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: domainRecord, error: null }))
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/domains/[domainId]/verify/route");
    const request = new NextRequest("http://localhost:3000/api/stores/domains/domain-1/verify", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.POST(request, { params: Promise.resolve({ domainId: "domain-1" }) });
    const payload = (await response.json()) as { verified: boolean; domain: { hosting_status: string } };

    expect(response.status).toBe(200);
    expect(payload.verified).toBe(true);
    expect(payload.domain.hosting_status).toBe("ready");
    expect(provisionVercelProjectDomainMock).toHaveBeenCalledWith("shop.example.com");
  });
});
