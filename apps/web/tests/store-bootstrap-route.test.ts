import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const seedStoreLegalDocumentsForStoreMock = vi.fn();

let storeInsertPayload: Record<string, unknown> | null = null;
let deletedStoreId: string | null = null;

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/legal/store-documents", () => ({
  seedStoreLegalDocumentsForStore: (...args: unknown[]) => seedStoreLegalDocumentsForStoreMock(...args)
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
                  data: { id: "store-1", name: "At Home Apothecary", slug: "at-home-apothecary", status: "draft" },
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
  storeInsertPayload = null;
  deletedStoreId = null;
  enforceTrustedOriginMock.mockReturnValue(null);
  seedStoreLegalDocumentsForStoreMock.mockResolvedValue(undefined);
});

describe("store bootstrap route", () => {
  test("seeds storefront legal documents after creating a store", async () => {
    const route = await import("@/app/api/stores/bootstrap/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/stores/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ storeName: "At Home Apothecary" })
      })
    );

    expect(response.status).toBe(201);
    expect(storeInsertPayload).toEqual(
      expect.objectContaining({
        name: "At Home Apothecary",
        status: "draft"
      })
    );
    expect(seedStoreLegalDocumentsForStoreMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        store: expect.objectContaining({ id: "store-1", slug: "at-home-apothecary" }),
        settings: { support_email: "owner@example.com" },
        publishedByUserId: "user-1"
      })
    );
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
        body: JSON.stringify({ storeName: "At Home Apothecary" })
      })
    );

    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Published storefront legal base templates are not available.");
    expect(deletedStoreId).toBe("store-1");
  });
});
