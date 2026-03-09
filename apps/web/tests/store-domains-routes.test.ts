import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();
const removeVercelProjectDomainMock = vi.fn();
const removeResendDomainMock = vi.fn();

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

vi.mock("@/lib/vercel/domains", () => ({
  removeVercelProjectDomain: (...args: unknown[]) => removeVercelProjectDomainMock(...args)
}));

vi.mock("@/lib/resend/domains", () => ({
  removeResendDomain: (...args: unknown[]) => removeResendDomainMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  requireStorePermissionMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();
  removeVercelProjectDomainMock.mockReset();
  removeResendDomainMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStorePermissionMock.mockResolvedValue({
    context: { storeId: "store-1", userId: "user-1", storeRole: "admin", globalRole: "user", storeSlug: "curby" },
    response: null
  });
  removeVercelProjectDomainMock.mockResolvedValue({ ok: true, status: "removed", error: null });
  removeResendDomainMock.mockResolvedValue({ ok: true, status: "removed", error: null });
});

describe("store domains routes", () => {
  test("POST requires white-label to be enabled before adding domain", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { white_label_enabled: false }, error: null }))
            }))
          }))
        };
      }
      if (table === "store_domains") {
        return {
          insert: vi.fn()
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/domains/route");
    const request = new NextRequest("http://localhost:3000/api/stores/domains", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ domain: "shop.example.com" })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Enable white-label");
  });

  test("PATCH rejects setting unverified domain as primary", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "store_domains") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "domain-1", verification_status: "pending" },
                  error: null
                }))
              }))
            }))
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/domains/[domainId]/route");
    const request = new NextRequest("http://localhost:3000/api/stores/domains/domain-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ isPrimary: true })
    });

    const response = await route.PATCH(request, { params: Promise.resolve({ domainId: "domain-1" }) });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("verified");
  });

  test("DELETE removes domain from Vercel before deleting local record", async () => {
    const deleteEqStoreIdMock = vi.fn(async () => ({ error: null }));
    const deleteEqIdMock = vi.fn(() => ({ eq: deleteEqStoreIdMock }));

    serverFromMock.mockImplementation((table: string) => {
      if (table === "store_domains") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "domain-1", domain: "shop.example.com", email_domain_id: null }, error: null }))
              }))
            }))
          })),
          delete: vi.fn(() => ({
            eq: deleteEqIdMock
          }))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/domains/[domainId]/route");
    const request = new NextRequest("http://localhost:3000/api/stores/domains/domain-1", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request, { params: Promise.resolve({ domainId: "domain-1" }) });
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(removeVercelProjectDomainMock).toHaveBeenCalledWith("shop.example.com");
    expect(removeResendDomainMock).toHaveBeenCalledWith(null);
    expect(deleteEqIdMock).toHaveBeenCalledWith("id", "domain-1");
    expect(deleteEqStoreIdMock).toHaveBeenCalledWith("store_id", "store-1");
  });
});
