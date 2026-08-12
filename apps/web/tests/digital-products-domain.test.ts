import { describe, expect, it } from "vitest";
import {
  isDigitalProductPublishable,
  resolveApplicableDigitalAssets,
  type DigitalAssetCandidate
} from "@/lib/digital-products/domain";

const readyProductAsset: DigitalAssetCandidate = {
  id: "asset-product",
  productVariantId: null,
  status: "ready",
  active: true
};

describe("digital product asset resolution", () => {
  it("includes product-wide assets and only assets for the purchased variant", () => {
    const assets: DigitalAssetCandidate[] = [
      readyProductAsset,
      { id: "asset-blue", productVariantId: "variant-blue", status: "ready", active: true },
      { id: "asset-red", productVariantId: "variant-red", status: "ready", active: true },
      { id: "asset-failed", productVariantId: null, status: "failed", active: true },
      { id: "asset-retired", productVariantId: null, status: "ready", active: false }
    ];

    expect(resolveApplicableDigitalAssets(assets, "variant-blue").map((asset) => asset.id)).toEqual([
      "asset-product",
      "asset-blue"
    ]);
  });

  it("requires a ready preview and at least one applicable file for every active variant", () => {
    expect(
      isDigitalProductPublishable({
        productType: "digital",
        rightsAffirmed: true,
        previewStatus: "ready",
        activeVariantIds: ["variant-blue", "variant-red"],
        assets: [
          { id: "asset-blue", productVariantId: "variant-blue", status: "ready", active: true },
          { id: "asset-red", productVariantId: "variant-red", status: "processing", active: true }
        ]
      })
    ).toEqual({ publishable: false, reason: "Every active variant needs at least one ready customer file." });

    expect(
      isDigitalProductPublishable({
        productType: "digital",
        rightsAffirmed: true,
        previewStatus: "ready",
        activeVariantIds: ["variant-blue", "variant-red"],
        assets: [readyProductAsset]
      })
    ).toEqual({ publishable: true, reason: null });
  });

  it("leaves physical product publishing unchanged", () => {
    expect(
      isDigitalProductPublishable({
        productType: "physical",
        rightsAffirmed: false,
        previewStatus: "missing",
        activeVariantIds: [],
        assets: []
      })
    ).toEqual({ publishable: true, reason: null });
  });
});
