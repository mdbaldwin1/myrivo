import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const getStorePrivacyRequestsByStoreIdMock = vi.fn();

type SupabaseMock = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

let supabaseMock: SupabaseMock;
let ownedStoreBundleMock:
  | {
      store: { id: string; slug: string; name: string };
      settings: { support_email: string | null } | null;
    }
  | null;
let updatePayload: Record<string, unknown> | null = null;

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabaseMock)
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundleForOptionalSlug: vi.fn(async () => ownedStoreBundleMock)
}));

vi.mock("@/lib/privacy/store-privacy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/privacy/store-privacy")>("@/lib/privacy/store-privacy");
  return {
    ...actual,
    getStorePrivacyRequestsByStoreId: (...args: unknown[]) => getStorePrivacyRequestsByStoreIdMock(...args)
  };
});

function buildSupabaseMock(): SupabaseMock {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } }))
    },
    from: vi.fn((table: string) => {
      if (table === "store_privacy_requests") {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayload = payload;
            const chain = {
              eq: vi.fn(() => chain)
            };
            return chain;
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    })
  };
}

beforeEach(() => {
  supabaseMock = buildSupabaseMock();
  ownedStoreBundleMock = {
    store: { id: "store-1", slug: "sunset-mercantile", name: "Sunset Mercantile" },
    settings: { support_email: "hello@example.com" }
  };
  updatePayload = null;
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  getStorePrivacyRequestsByStoreIdMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  getStorePrivacyRequestsByStoreIdMock.mockResolvedValue([
    {
      id: "request-1",
      store_id: "store-1",
      email: "shopper@example.com",
      full_name: "Shopper",
      request_type: "access",
      status: "in_progress",
      source: "privacy_page",
      details: "Need details.",
      metadata_json: { global_privacy_control: true },
      resolved_at: null,
      resolved_by_user_id: null,
      created_at: "2026-03-13T00:00:00.000Z",
      updated_at: "2026-03-13T00:00:00.000Z"
    }
  ]);
});

describe("store privacy requests route", () => {
  test("GET returns recent privacy requests", async () => {
    const { GET } = await import("@/app/api/stores/privacy-requests/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/stores/privacy-requests?storeSlug=apothecary"));
    if (!response) {
      throw new Error("GET handler returned no response");
    }
    const payload = (await response.json()) as { requests: Array<{ id: string; status: string }> };

    expect(response.status).toBe(200);
    expect(payload.requests[0]).toMatchObject({ id: "request-1", status: "in_progress" });
    expect(payload.requests[0]).toMatchObject({
      source: "privacy_page",
      metadata_json: { global_privacy_control: true }
    });
  });

  test("PATCH updates request status and logs audit metadata", async () => {
    const { PATCH } = await import("@/app/api/stores/privacy-requests/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/stores/privacy-requests?storeSlug=apothecary", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          requestId: "5dfde754-f29e-420e-9a4b-32f15f77bc67",
          status: "completed"
        })
      })
    );
    if (!response) {
      throw new Error("PATCH handler returned no response");
    }

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual(
      expect.objectContaining({
        status: "completed",
        resolved_by_user_id: "user-1"
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
