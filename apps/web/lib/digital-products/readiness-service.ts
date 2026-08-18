import { resolveDigitalProductReadiness } from "./domain";
import type {
  DigitalAssetStatus,
  DigitalPreviewStatus,
  DigitalProductReadiness,
  DigitalProductReadinessReason,
  ProductType,
} from "./types";

type DatabaseError = { message: string; code?: string };
type DatabaseResult = { data: unknown; error: DatabaseError | null };
type ReadinessFilter = {
  eq(column: string, value: unknown): ReadinessFilter;
  single(): PromiseLike<DatabaseResult>;
  maybeSingle(): PromiseLike<DatabaseResult>;
  returns(): PromiseLike<DatabaseResult>;
};
type ReadinessQuery = {
  select(columns: string): ReadinessFilter;
};

export type ReadinessAdminClient = {
  from(table: string): ReadinessQuery;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<DatabaseResult>;
};

export type ProposedDigitalProductState = {
  productType?: ProductType;
  rightsAffirmedAt?: string | null;
  variants?: ReadonlyArray<{ id: string; status: "active" | "archived" }>;
};

export type DigitalCatalogVariantMutation = {
  id: string;
  title: string | null;
  sku: string | null;
  sku_mode: "auto" | "manual";
  image_urls: string[];
  group_image_urls: string[];
  option_values: Record<string, string>;
  price_cents: number;
  inventory_qty: number;
  is_made_to_order: boolean;
  is_default: boolean;
  status: "active" | "archived";
  sort_order: number;
  fulfillment_type: "physical" | "digital" | null;
};

export type DigitalCatalogMutationResult = {
  applied: boolean;
  code:
    | "applied"
    | "digital_product_not_ready"
    | "fresh_rights_affirmation_required"
    | "product_type_has_order_history"
    | "product_unavailable";
  reasons: DigitalProductReadinessReason[];
};

type ProductRow = {
  product_type: ProductType;
  digital_rights_affirmed_at: string | null;
};

type VariantRow = { id: string; status: "active" | "archived" };

type AssetRow = {
  id: string;
  product_variant_id: string | null;
  active: boolean;
  digital_product_asset_versions: Array<{
    id: string;
    status: DigitalAssetStatus;
    retired_at: string | null;
  }> | null;
};

function databaseFailure(): never {
  throw new Error("Unable to load digital product readiness.");
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return data && typeof data === "object" ? (data as T) : null;
}

function isMutationResult(value: unknown): value is DigitalCatalogMutationResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.applied === "boolean" &&
    typeof candidate.code === "string" &&
    Array.isArray(candidate.reasons) &&
    candidate.reasons.every((reason) => typeof reason === "string")
  );
}

export async function loadDigitalProductReadiness(input: {
  admin: ReadinessAdminClient;
  storeId: string;
  productId: string;
  proposed?: ProposedDigitalProductState;
}): Promise<DigitalProductReadiness> {
  const productResult = await input.admin
    .from("products")
    .select("product_type,digital_rights_affirmed_at")
    .eq("id", input.productId)
    .eq("store_id", input.storeId)
    .single();
  const product = firstRow<ProductRow>(productResult.data);
  if (productResult.error || !product) databaseFailure();

  const previewResult = await input.admin
    .from("digital_product_previews")
    .select("status")
    .eq("product_id", input.productId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (previewResult.error) databaseFailure();
  const preview = firstRow<{ status: DigitalPreviewStatus }>(previewResult.data);

  const variantsResult = await input.admin
    .from("product_variants")
    .select("id,status")
    .eq("product_id", input.productId)
    .eq("store_id", input.storeId)
    .returns();
  if (variantsResult.error) databaseFailure();
  const variants = (variantsResult.data ?? []) as VariantRow[];

  const assetsResult = await input.admin
    .from("digital_product_assets")
    .select(
      "id,product_variant_id,active,digital_product_asset_versions(id,status,retired_at)",
    )
    .eq("product_id", input.productId)
    .eq("store_id", input.storeId)
    .returns();
  if (assetsResult.error) databaseFailure();
  const assets = (assetsResult.data ?? []) as AssetRow[];

  const proposed = input.proposed;
  return resolveDigitalProductReadiness({
    product: {
      product_type: proposed?.productType ?? product.product_type,
      digital_rights_affirmed_at:
        proposed && "rightsAffirmedAt" in proposed
          ? proposed.rightsAffirmedAt ?? null
          : product.digital_rights_affirmed_at,
    },
    previewStatus: preview?.status ?? "missing",
    variants: proposed?.variants ?? variants,
    assets: assets.map((asset) => ({
      id: asset.id,
      productVariantId: asset.product_variant_id,
      active: asset.active,
      versions: (asset.digital_product_asset_versions ?? []).map((version) => ({
        id: version.id,
        status: version.status,
        retiredAt: version.retired_at,
      })),
    })),
  });
}

export async function applyDigitalProductCatalogUpdate(input: {
  admin: ReadinessAdminClient;
  storeId: string;
  productId: string;
  actorUserId: string;
  currentProductType: ProductType;
  nextProductType: ProductType;
  nextStatus: "draft" | "active" | "archived";
  nextRightsAffirmedAt: string | null;
  productUpdates: Record<string, unknown>;
  variants: DigitalCatalogVariantMutation[] | null;
  variantTierLevels: string[] | null;
}): Promise<DigitalCatalogMutationResult> {
  if (
    input.currentProductType === input.nextProductType &&
    input.nextProductType === "digital" &&
    input.nextStatus === "active"
  ) {
    const readiness = await loadDigitalProductReadiness({
      admin: input.admin,
      storeId: input.storeId,
      productId: input.productId,
      proposed: {
        productType: input.nextProductType,
        rightsAffirmedAt: input.nextRightsAffirmedAt,
        ...(input.variants
          ? {
              variants: input.variants.map((variant) => ({
                id: variant.id,
                status: variant.status,
              })),
            }
          : {}),
      },
    });
    if (!readiness.ready) {
      return {
        applied: false,
        code: "digital_product_not_ready",
        reasons: readiness.reasons,
      };
    }
  }

  const { data, error } = await input.admin.rpc(
    "apply_digital_product_catalog_update",
    {
      p_store_id: input.storeId,
      p_product_id: input.productId,
      p_actor_user_id: input.actorUserId,
      p_product_updates: input.productUpdates,
      p_variants: input.variants,
      p_variant_tier_levels: input.variantTierLevels,
    },
  );
  if (error) {
    throw new Error("Unable to update this product.");
  }
  const result = firstRow<DigitalCatalogMutationResult>(data);
  if (!isMutationResult(result)) {
    throw new Error("Unable to update this product.");
  }
  return result;
}

export function readinessFailurePayload(result: DigitalCatalogMutationResult) {
  const error =
    result.code === "product_type_has_order_history"
      ? "Products with order history cannot change fulfillment type."
      : result.code === "fresh_rights_affirmation_required"
        ? "Confirm that you own or control the rights to these files."
        : result.code === "product_unavailable"
          ? "Product unavailable."
          : "This digital product is not ready to publish.";
  return { error, code: result.code, reasons: result.reasons };
}

export function digitalReadinessReasonLabel(reason: DigitalProductReadinessReason) {
  if (reason === "rights_missing") {
    return "Confirm that you own or control the rights to these files.";
  }
  if (reason === "preview_not_ready") {
    return "Wait for the watermarked storefront preview to finish.";
  }
  if (reason === "product_missing_file") {
    return "Attach at least one ready customer file.";
  }
  return "Attach a ready customer file to each active variant.";
}
