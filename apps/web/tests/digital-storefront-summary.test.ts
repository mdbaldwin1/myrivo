import { describe, expect, test, vi } from "vitest";
import { enrichStorefrontDigitalProducts } from "@/lib/digital-products/storefront-summary";

function query(data: unknown) {
  const value: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    value[method] = vi.fn(() => value);
  }
  value.returns = vi.fn(async () => ({ data, error: null }));
  value.then = vi.fn((resolve: (result: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve));
  return value;
}

describe("digital storefront summary", () => {
  test("exposes only a public preview and selected-file labels/formats", async () => {
    const previewQuery = query([{ product_id: "product-digital", public_preview_path: "store/product/preview.png" }]);
    const assetQuery = query([
      {
        product_id: "product-digital",
        product_variant_id: null,
        label: "Printing guide",
        sort_order: 0,
        digital_product_asset_versions: [
          { mime_type: "application/pdf", status: "ready", version_number: 1, retired_at: null }
        ]
      },
      {
        product_id: "product-digital",
        product_variant_id: "variant-a4",
        label: "A4 artwork",
        sort_order: 1,
        digital_product_asset_versions: [
          { mime_type: "image/png", status: "ready", version_number: 2, retired_at: null },
          { mime_type: "image/jpeg", status: "ready", version_number: 1, retired_at: "2026-08-01T00:00:00.000Z" }
        ]
      }
    ]);
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example.test/watermarked.png" } }));
    const admin = {
      from: vi.fn((table: string) => table === "digital_product_previews" ? previewQuery : assetQuery),
      storage: { from: vi.fn(() => ({ getPublicUrl })) }
    };

    const result = await enrichStorefrontDigitalProducts({
      admin: admin as never,
      storeId: "store-1",
      products: [
        { id: "product-digital", product_type: "digital" as const, title: "Printable" },
        { id: "product-physical", product_type: "physical" as const, title: "Frame" }
      ]
    });

    expect(result[0]).toMatchObject({
      digital_summary: {
        publicPreviewUrl: "https://cdn.example.test/watermarked.png",
        files: [
          { variantId: null, label: "Printing guide", format: "PDF" },
          { variantId: "variant-a4", label: "A4 artwork", format: "PNG" }
        ]
      }
    });
    expect(result[1]).toMatchObject({ digital_summary: null });
    expect(getPublicUrl).toHaveBeenCalledWith("store/product/preview.png");
    expect(assetQuery.select).toHaveBeenCalledWith(expect.not.stringContaining("storage_path"));
    expect(assetQuery.select).toHaveBeenCalledWith(expect.not.stringContaining("customer_filename"));
  });
});
