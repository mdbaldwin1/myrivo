import type { ProductRecord, ProductVariantStatus } from "@/types/database";

export type ProductType = "physical" | "digital";
export type DigitalAssetStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "failed";
export type DigitalPreviewStatus =
  | "missing"
  | "processing"
  | "ready"
  | "failed";
export type DigitalEntitlementStatus = "active" | "suspended" | "revoked";
export type DigitalDeliveryState =
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export type DigitalPurchaseManifestItem = {
  readonly orderItemId: string | null;
  readonly productId: string;
  readonly productVariantId: string | null;
  readonly assetId: string;
  readonly assetVersionId: string;
  readonly customerFilename: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly label: string;
  readonly sortOrder: number;
};

export type DigitalPurchaseManifest = {
  readonly manifestId: string;
  readonly orderId: string | null;
  readonly checkoutSessionId: string;
  readonly storeId: string;
  readonly consentVersion: string;
  readonly licenseVersion: string;
  readonly createdAt: string;
  readonly items: ReadonlyArray<DigitalPurchaseManifestItem>;
};

export type DigitalProductReadinessReason =
  | "rights_missing"
  | "preview_not_ready"
  | "product_missing_file"
  | `variant_missing_file:${string}`;

export type DigitalProductReadiness = {
  readonly ready: boolean;
  readonly reasons: DigitalProductReadinessReason[];
  readonly applicableFileCount: number;
  readonly previewStatus: DigitalPreviewStatus;
};

export type DigitalProductReadinessAssetVersion = {
  readonly id: string;
  readonly status: DigitalAssetStatus;
  readonly retiredAt: string | null;
};

export type DigitalProductReadinessAsset = {
  readonly id: string;
  readonly productVariantId: string | null;
  readonly active: boolean;
  readonly versions: ReadonlyArray<DigitalProductReadinessAssetVersion>;
};

export type DigitalProductReadinessInput = {
  readonly product: Pick<
    ProductRecord,
    "product_type" | "digital_rights_affirmed_at"
  >;
  readonly previewStatus: DigitalPreviewStatus;
  readonly variants: ReadonlyArray<{
    readonly id: string;
    readonly status: ProductVariantStatus;
  }>;
  readonly assets: ReadonlyArray<DigitalProductReadinessAsset>;
};
