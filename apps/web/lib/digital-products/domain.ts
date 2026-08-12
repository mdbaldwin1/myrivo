export type ProductType = "physical" | "digital";
export type DigitalAssetStatus = "uploading" | "processing" | "ready" | "failed";
export type DigitalPreviewStatus = "missing" | "processing" | "ready" | "failed";
export type DigitalEntitlementStatus = "active" | "suspended" | "revoked";

export type DigitalAssetCandidate = {
  id: string;
  productVariantId: string | null;
  status: DigitalAssetStatus;
  active: boolean;
};

export function resolveApplicableDigitalAssets(assets: DigitalAssetCandidate[], productVariantId: string | null) {
  return assets.filter(
    (asset) =>
      asset.active &&
      asset.status === "ready" &&
      (asset.productVariantId === null || asset.productVariantId === productVariantId)
  );
}

export function isDigitalProductPublishable(input: {
  productType: ProductType;
  rightsAffirmed: boolean;
  previewStatus: DigitalPreviewStatus;
  activeVariantIds: string[];
  assets: DigitalAssetCandidate[];
}): { publishable: boolean; reason: string | null } {
  if (input.productType === "physical") return { publishable: true, reason: null };
  if (!input.rightsAffirmed) return { publishable: false, reason: "Confirm that you own or control the rights to these files." };
  if (input.previewStatus !== "ready") return { publishable: false, reason: "A watermarked storefront preview must be ready." };

  const targets = input.activeVariantIds.length > 0 ? input.activeVariantIds : [null];
  if (targets.some((variantId) => resolveApplicableDigitalAssets(input.assets, variantId).length === 0)) {
    return { publishable: false, reason: "Every active variant needs at least one ready customer file." };
  }
  return { publishable: true, reason: null };
}
