import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const seedStoreLegalDocumentsForStoreMock = vi.fn();
const createOrResumeOnboardingSessionMock = vi.fn();

let storeInsertPayload: Record<string, unknown> | null = null;
let deletedStoreId: string | null = null;

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/legal/store-documents", () => ({
  seedStoreLegalDocumentsForStore: (...args: unknown[]) => seedStoreLegalDocumentsForStoreMock(...args)
}));

vi.mock("@/lib/onboarding/session", () => ({
  createOrResumeOnboardingSession: (...args: unknown[]) => createOrResumeOnboardingSessionMock(...args)
}));

function buildSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "user-1",
            email: "owner@example.com"
          }
        }
      }))
    },
    from: vi.fn((table: string) => {
      if (table === "stores") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            storeInsertPayload = payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: "store-1", name: "Sunset Mercantile", slug: "sunset-mercantile", status: "draft" },
                  error: null
                }))
              }))
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((_: string, value: string) => ({
              eq: vi.fn(async () => {
                deletedStoreId = value;
                return { error: null };
              })
            }))
          }))
        };
      }

      if (table === "store_memberships" || table === "store_branding" || table === "store_settings") {
        return {
          upsert: vi.fn(async () => ({ error: null }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => buildSupabaseMock())
}));

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  seedStoreLegalDocumentsForStoreMock.mockReset();
  createOrResumeOnboardingSessionMock.mockReset();
  storeInsertPayload = null;
  deletedStoreId = null;
  enforceTrustedOriginMock.mockReturnValue(null);
  seedStoreLegalDocumentsForStoreMock.mockResolvedValue(undefined);
  createOrResumeOnboardingSessionMock.mockResolvedValue({ id: "session-1" });
});

describe("store bootstrap route", () => {
  test("seeds storefront legal documents and creates an onboarding session after creating a store", async () => {
    const route = await import("@/app/api/stores/bootstrap/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ storeName: "Sunset Mercantile" })
      })
    );

    const payload = (await response.json()) as { store?: { id: string }; onboardingSessionId?: string };

    expect(response.status).toBe(201);
    expect(payload.onboardingSessionId).toBe("session-1");
    expect(storeInsertPayload).toEqual(
      expect.objectContaining({
        name: "Sunset Mercantile",
        status: "draft"
      })
    );
    expect(seedStoreLegalDocumentsForStoreMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        store: expect.objectContaining({ id: "store-1", slug: "sunset-mercantile" }),
        settings: { support_email: "owner@example.com" },
        publishedByUserId: "user-1"
      })
    );
    expect(createOrResumeOnboardingSessionMock).toHaveBeenCalledWith({
      storeId: "store-1",
      ownerUserId: "user-1",
      storeName: "Sunset Mercantile"
    });
  });

  test("cleans up the created store when legal seeding fails", async () => {
    seedStoreLegalDocumentsForStoreMock.mockRejectedValue(new Error("Published storefront legal base templates are not available."));

    const route = await import("@/app/api/stores/bootstrap/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ storeName: "Sunset Mercantile" })
      })
    );

    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Published storefront legal base templates are not available.");
    expect(deletedStoreId).toBe("store-1");
  });

  test("cleans up the created store when onboarding session setup fails", async () => {
    createOrResumeOnboardingSessionMock.mockRejectedValue(new Error("Unable to create onboarding session."));

    const route = await import("@/app/api/stores/bootstrap/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ storeName: "Sunset Mercantile" })
      })
    );

    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Unable to create onboarding session.");
    expect(deletedStoreId).toBe("store-1");
  });
});
