import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/digital-products/feature-gating", () => ({
  resolveStoreDigitalProductsAccess: vi.fn(async () => ({ enabled: true, planEligible: true, storeEnabled: true, planKey: "test" }))
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args),
  })),
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args),
}));

describe("digital asset catalog route", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getOwnedStoreBundleMock.mockReset();
    adminFromMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1" } });
  });

  test("returns safe failed upload intents so a merchant can resume after reloading", async () => {
    adminFromMock.mockImplementation((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(async () => table === "digital_product_assets"
          ? { data: [], error: null }
          : {
              data: [{
                id: "50000000-0000-4000-8000-000000000001",
                asset_id: "60000000-0000-4000-8000-000000000001",
                operation: "create",
                label: "Printable artwork",
                expected_filename: "artwork.pdf",
                expected_mime_type: "application/pdf",
                expected_byte_size: 1024,
                product_variant_id: null,
                last_safe_error: "Upload verification was interrupted.",
                version_number: 1,
                updated_at: "2026-08-13T12:00:00.000Z",
              }],
              error: null,
            }),
      };
      return query;
    });

    const route = await import("@/app/api/products/digital-assets/route");
    const response = await route.GET(new NextRequest(
      "http://localhost:3000/api/products/digital-assets?productId=20000000-0000-4000-8000-000000000001",
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      assets: [],
      failedUploads: [{
        id: "50000000-0000-4000-8000-000000000001",
        asset_id: "60000000-0000-4000-8000-000000000001",
        operation: "create",
        label: "Printable artwork",
        expected_filename: "artwork.pdf",
        expected_mime_type: "application/pdf",
        expected_byte_size: 1024,
        product_variant_id: null,
        last_safe_error: "Upload verification was interrupted.",
        version_number: 1,
        updated_at: "2026-08-13T12:00:00.000Z",
      }],
    });
    expect(adminFromMock).toHaveBeenCalledWith("digital_asset_upload_intents");
    expect(JSON.stringify(payload)).not.toContain("storage_path");
  });
});
