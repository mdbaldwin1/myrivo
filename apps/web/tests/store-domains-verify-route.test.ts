import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const requireStorePermissionMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const serverFromMock = vi.fn();
const resolveTxtMock = vi.fn();
const resolveNsMock = vi.fn();
const resolve4Mock = vi.fn();
const resolve6Mock = vi.fn();
const resolverSetServersMock = vi.fn();
const resolverResolveTxtMock = vi.fn();
const provisionVercelProjectDomainMock = vi.fn();
const provisionResendDomainMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  resolveTxt: (...args: unknown[]) => resolveTxtMock(...args),
  resolveNs: (...args: unknown[]) => resolveNsMock(...args),
  resolve4: (...args: unknown[]) => resolve4Mock(...args),
  resolve6: (...args: unknown[]) => resolve6Mock(...args),
  Resolver: class {
    setServers(...args: unknown[]) {
      return resolverSetServersMock(...args);
    }
    resolveTxt(...args: unknown[]) {
      return resolverResolveTxtMock(...args);
    }
  }
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStorePermission: (...args: unknown[]) => requireStorePermissionMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/vercel/domains", () => ({
  provisionVercelProjectDomain: (...args: unknown[]) => provisionVercelProjectDomainMock(...args)
}));

vi.mock("@/lib/resend/domains", () => ({
  provisionResendDomain: (...args: unknown[]) => provisionResendDomainMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  requireStorePermissionMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  serverFromMock.mockReset();
  resolveTxtMock.mockReset();
  resolveNsMock.mockReset();
  resolve4Mock.mockReset();
  resolve6Mock.mockReset();
  resolverSetServersMock.mockReset();
  resolverResolveTxtMock.mockReset();
  provisionVercelProjectDomainMock.mockReset();
  provisionResendDomainMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  requireStorePermissionMock.mockResolvedValue({
    context: { storeId: "store-1", userId: "user-1", storeRole: "admin", globalRole: "user", storeSlug: "curby" },
    response: null
  });

  resolveNsMock.mockResolvedValue([]);
  resolve4Mock.mockResolvedValue([]);
  resolve6Mock.mockResolvedValue([]);
  resolverResolveTxtMock.mockResolvedValue([]);
  provisionResendDomainMock.mockResolvedValue({
    status: "provisioning",
    metadata: {},
    error: null,
    domainId: "resend-domain-default"
  });
  process.env.MYRIVO_BRANDED_EMAIL_POLICY = "all";
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
      email_provider: "resend",
      email_sender_enabled: true,
      email_status: "ready",
      email_domain_id: "resend-domain-1",
      email_last_checked_at: "2026-03-01T00:00:00.000Z",
      email_ready_at: "2026-03-01T00:00:00.000Z",
      email_error: null,
      email_metadata_json: {},
      created_at: "2026-03-01T00:00:00.000Z"
    };

    resolveTxtMock.mockResolvedValue([[domainRecord.verification_token]]);
    provisionVercelProjectDomainMock.mockResolvedValue({
      status: "ready",
      metadata: { example: true },
      error: null
    });
    provisionResendDomainMock.mockResolvedValue({
      status: "ready",
      metadata: { email: true },
      error: null,
      domainId: "resend-domain-1"
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
          update: vi.fn((values: Record<string, unknown>) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { ...domainRecord, ...values }, error: null }))
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
    expect(provisionResendDomainMock).not.toHaveBeenCalled();
  });

  test("still fetches Vercel DNS metadata when TXT verification fails", async () => {
    const domainRecord = {
      id: "domain-2",
      store_id: "store-1",
      domain: "shop.example.com",
      is_primary: false,
      verification_status: "pending",
      verification_token: "myrivo-token",
      last_verification_at: null,
      verified_at: null,
      hosting_provider: "vercel",
      hosting_status: "pending",
      hosting_last_checked_at: null,
      hosting_ready_at: null,
      hosting_error: null,
      hosting_metadata_json: {},
      email_provider: "resend",
      email_sender_enabled: true,
      email_status: "pending",
      email_domain_id: null,
      email_last_checked_at: null,
      email_ready_at: null,
      email_error: null,
      email_metadata_json: {},
      created_at: "2026-03-01T00:00:00.000Z"
    };

    const updatePayloads: Array<Record<string, unknown>> = [];

    resolveTxtMock.mockRejectedValue(new Error("ENOTFOUND"));
    provisionVercelProjectDomainMock.mockResolvedValue({
      status: "provisioning",
      metadata: {
        domainStatus: {
          verification: [{ type: "A", domain: "shop.example.com", value: "216.198.79.1", verified: false }]
        }
      },
      error: null
    });
    provisionResendDomainMock.mockResolvedValue({
      status: "provisioning",
      metadata: {
        domain: {
          records: [{ record: "TXT", name: "shop.example.com", value: "v=spf1 include:resend.net ~all", status: "pending" }]
        }
      },
      error: null,
      domainId: "resend-domain-2"
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
          update: vi.fn((values: Record<string, unknown>) => {
            updatePayloads.push(values);
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({ data: { ...domainRecord, ...values }, error: null }))
                  }))
                }))
              }))
            };
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/domains/[domainId]/verify/route");
    const request = new NextRequest("http://localhost:3000/api/stores/domains/domain-2/verify", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.POST(request, { params: Promise.resolve({ domainId: "domain-2" }) });
    const payload = (await response.json()) as { verified: boolean; domain: { hosting_status: string; hosting_metadata_json: unknown } };

    expect(response.status).toBe(200);
    expect(payload.verified).toBe(false);
    expect(payload.domain.hosting_status).toBe("pending");
    expect(provisionVercelProjectDomainMock).toHaveBeenCalledWith("shop.example.com");
    expect(provisionResendDomainMock).not.toHaveBeenCalled();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]?.hosting_metadata_json).toEqual({
      domainStatus: {
        verification: [{ type: "A", domain: "shop.example.com", value: "216.198.79.1", verified: false }]
      }
    });
  });

  test("uses authoritative DNS fallback when recursive lookup is stale", async () => {
    const domainRecord = {
      id: "domain-3",
      store_id: "store-1",
      domain: "shop.example.com",
      is_primary: false,
      verification_status: "pending",
      verification_token: "myrivo-token",
      last_verification_at: null,
      verified_at: null,
      hosting_provider: "vercel",
      hosting_status: "pending",
      hosting_last_checked_at: null,
      hosting_ready_at: null,
      hosting_error: null,
      hosting_metadata_json: {},
      email_provider: "resend",
      email_sender_enabled: true,
      email_status: "pending",
      email_domain_id: null,
      email_last_checked_at: null,
      email_ready_at: null,
      email_error: null,
      email_metadata_json: {},
      created_at: "2026-03-01T00:00:00.000Z"
    };

    resolveTxtMock.mockRejectedValue(new Error("ENOTFOUND"));
    resolveNsMock.mockResolvedValue(["dns1.registrar-servers.com"]);
    resolve4Mock.mockResolvedValue(["156.154.132.200"]);
    resolve6Mock.mockResolvedValue([]);
    resolverResolveTxtMock.mockResolvedValue([[domainRecord.verification_token]]);
    provisionVercelProjectDomainMock.mockResolvedValue({
      status: "ready",
      metadata: {},
      error: null
    });
    provisionResendDomainMock.mockResolvedValue({
      status: "ready",
      metadata: {},
      error: null,
      domainId: "resend-domain-3"
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
          update: vi.fn((values: Record<string, unknown>) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { ...domainRecord, ...values }, error: null }))
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/stores/domains/[domainId]/verify/route");
    const request = new NextRequest("http://localhost:3000/api/stores/domains/domain-3/verify", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.POST(request, { params: Promise.resolve({ domainId: "domain-3" }) });
    const payload = (await response.json()) as { verified: boolean; domain: { hosting_status: string } };

    expect(response.status).toBe(200);
    expect(payload.verified).toBe(true);
    expect(payload.domain.hosting_status).toBe("ready");
    expect(resolveNsMock).toHaveBeenCalledWith("shop.example.com");
    expect(resolverSetServersMock).toHaveBeenCalledWith(["156.154.132.200"]);
    expect(resolverResolveTxtMock).toHaveBeenCalledWith("_myrivo-verification.shop.example.com");
    expect(provisionResendDomainMock).not.toHaveBeenCalled();
  });
});
