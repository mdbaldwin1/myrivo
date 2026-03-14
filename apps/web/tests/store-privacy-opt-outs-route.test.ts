import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const getStorePrivacyOptOutsByStoreIdMock = vi.fn();

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
    getStorePrivacyOptOutsByStoreId: (...args: unknown[]) => getStorePrivacyOptOutsByStoreIdMock(...args)
  };
});

function buildSupabaseMock(): SupabaseMock {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } }))
    },
    from: vi.fn((table: string) => {
      if (table === "store_privacy_opt_outs") {
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
    store: { id: "store-1", slug: "apothecary", name: "At Home Apothecary" },
    settings: { support_email: "hello@example.com" }
  };
  updatePayload = null;
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  getStorePrivacyOptOutsByStoreIdMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  getStorePrivacyOptOutsByStoreIdMock.mockResolvedValue([
    {
      id: "opt-out-1",
      store_id: "store-1",
      email: "shopper@example.com",
      full_name: "Shopper",
      state: "active",
      source: "privacy_page",
      latest_request_id: "request-1",
      metadata_json: {},
      created_at: "2026-03-13T00:00:00.000Z",
      updated_at: "2026-03-13T00:00:00.000Z"
    }
  ]);
});

describe("store privacy opt-outs route", () => {
  test("GET returns explicit opt-out states", async () => {
    const { GET } = await import("@/app/api/stores/privacy-opt-outs/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/stores/privacy-opt-outs?storeSlug=apothecary"));
    if (!response) {
      throw new Error("GET handler returned no response");
    }
    const payload = (await response.json()) as { optOuts: Array<{ id: string; state: string }> };

    expect(response.status).toBe(200);
    expect(payload.optOuts[0]).toMatchObject({ id: "opt-out-1", state: "active" });
  });

  test("PATCH updates opt-out state and logs audit metadata", async () => {
    const { PATCH } = await import("@/app/api/stores/privacy-opt-outs/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/stores/privacy-opt-outs?storeSlug=apothecary", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          optOutId: "5dfde754-f29e-420e-9a4b-32f15f77bc67",
          state: "revoked"
        })
      })
    );
    if (!response) {
      throw new Error("PATCH handler returned no response");
    }

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual(
      expect.objectContaining({
        state: "revoked",
        metadata_json: { updated_by_operator: true }
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
