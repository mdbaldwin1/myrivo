import type {
  DigitalAssetStatus,
  DigitalPreviewStatus,
  DigitalProductReadiness,
  DigitalProductReadinessAsset,
  DigitalProductReadinessInput,
  ProductType,
} from "./types";

export type {
  DigitalAssetStatus,
  DigitalDeliveryState,
  DigitalEntitlementStatus,
  DigitalPreviewStatus,
  DigitalProductReadiness,
  DigitalProductReadinessInput,
  DigitalProductReadinessReason,
  DigitalPurchaseManifest,
  DigitalPurchaseManifestItem,
  ProductType,
} from "./types";

export type DigitalAssetCandidate = {
  id: string;
  productVariantId: string | null;
  status: DigitalAssetStatus;
  active: boolean;
};

export function resolveApplicableDigitalAssets(
  assets: DigitalAssetCandidate[],
  productVariantId: string | null,
) {
  return assets.filter(
    (asset) =>
      asset.active &&
      asset.status === "ready" &&
      (asset.productVariantId === null ||
        asset.productVariantId === productVariantId),
  );
}

function hasReadyVersion(asset: DigitalProductReadinessAsset) {
  return asset.versions.some(
    (version) => version.status === "ready" && version.retiredAt === null,
  );
}

export function resolveDigitalProductReadiness(
  input: DigitalProductReadinessInput,
): DigitalProductReadiness {
  if (input.product.product_type === "physical") {
    return {
      ready: true,
      reasons: [],
      applicableFileCount: 0,
      previewStatus: input.previewStatus,
    };
  }

  const reasons: DigitalProductReadiness["reasons"] = [];
  const activeVariantIds = new Set(
    input.variants
      .filter((variant) => variant.status === "active")
      .map((variant) => variant.id),
  );
  const applicableAssets = input.assets.filter(
    (asset) =>
      asset.active &&
      hasReadyVersion(asset) &&
      (asset.productVariantId === null ||
        activeVariantIds.has(asset.productVariantId)),
  );

  if (!input.product.digital_rights_affirmed_at) {
    reasons.push("rights_missing");
  }
  if (input.previewStatus !== "ready") {
    reasons.push("preview_not_ready");
  }

  if (activeVariantIds.size === 0) {
    if (!applicableAssets.some((asset) => asset.productVariantId === null)) {
      reasons.push("product_missing_file");
    }
  } else {
    for (const variantId of activeVariantIds) {
      const hasApplicableFile = applicableAssets.some(
        (asset) =>
          asset.productVariantId === null ||
          asset.productVariantId === variantId,
      );
      if (!hasApplicableFile) {
        reasons.push(`variant_missing_file:${variantId}`);
      }
    }
  }

  return {
    ready: reasons.length === 0,
    reasons,
    applicableFileCount: applicableAssets.length,
    previewStatus: input.previewStatus,
  };
}

export function isDigitalProductPublishable(input: {
  productType: ProductType;
  rightsAffirmed: boolean;
  previewStatus: DigitalPreviewStatus;
  activeVariantIds: string[];
  assets: DigitalAssetCandidate[];
}): { publishable: boolean; reason: string | null } {
  const readiness = resolveDigitalProductReadiness({
    product: {
      product_type: input.productType,
      digital_rights_affirmed_at: input.rightsAffirmed ? "affirmed" : null,
    },
    previewStatus: input.previewStatus,
    variants: input.activeVariantIds.map((id) => ({ id, status: "active" })),
    assets: input.assets.map((asset) => ({
      id: asset.id,
      productVariantId: asset.productVariantId,
      active: asset.active,
      versions: [
        { id: `${asset.id}:current`, status: asset.status, retiredAt: null },
      ],
    })),
  });

  if (readiness.ready) return { publishable: true, reason: null };
  if (readiness.reasons.includes("rights_missing")) {
    return {
      publishable: false,
      reason: "Confirm that you own or control the rights to these files.",
    };
  }
  if (readiness.reasons.includes("preview_not_ready")) {
    return {
      publishable: false,
      reason: "A watermarked storefront preview must be ready.",
    };
  }
  return {
    publishable: false,
    reason: "Every active variant needs at least one ready customer file.",
  };
}
