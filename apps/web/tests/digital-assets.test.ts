import { describe, expect, it } from "vitest";
import {
  buildDigitalAssetStoragePath,
  validateDigitalAssetUpload
} from "@/lib/digital-products/assets";

describe("digital asset uploads", () => {
  it("accepts supported files within the configured limit", () => {
    expect(validateDigitalAssetUpload({ fileName: "print.png", mimeType: "image/png", sizeBytes: 1024 })).toEqual({ ok: true });
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateDigitalAssetUpload({ fileName: "movie.mp4", mimeType: "video/mp4", sizeBytes: 1024 }).ok).toBe(false);
    expect(validateDigitalAssetUpload({ fileName: "print.png", mimeType: "image/png", sizeBytes: 300 * 1024 * 1024 }).ok).toBe(false);
  });

  it("builds a private path without retaining unsafe filename characters", () => {
    const path = buildDigitalAssetStoragePath({ storeId: "store", productId: "product", assetId: "asset", version: 2, fileName: "My Print (final).PNG" });
    expect(path).toBe("store/product/asset/v2/my-print-final.png");
  });
});
