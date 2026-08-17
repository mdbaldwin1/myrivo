import { digitalReadinessReasonLabel } from "@/lib/digital-products/readiness-service";
import type { DigitalProductReadiness } from "@/lib/digital-products/types";
import type { ProductRecord } from "@/types/database";

export type ProductVariantListItem = {
  id: string;
  title: string | null;
  sku: string | null;
  sku_mode: "auto" | "manual";
  image_urls: string[] | null;
  group_image_urls: string[] | null;
  option_values: Record<string, string>;
  price_cents: number;
  inventory_qty: number;
  is_made_to_order: boolean;
  is_default: boolean;
  status: "active" | "archived";
  sort_order: number;
  created_at: string;
};

export type ProductListItem = Pick<
  ProductRecord,
  | "id"
  | "title"
  | "description"
  | "slug"
  | "sku"
  | "image_urls"
  | "image_alt_text"
  | "seo_title"
  | "seo_description"
  | "is_featured"
  | "price_cents"
  | "inventory_qty"
  | "status"
  | "product_type"
  | "digital_rights_affirmed_at"
  | "created_at"
> & {
  digital_readiness?: DigitalProductReadiness | null;
  digital_preview?: DigitalProductPreview | null;
  product_variants: ProductVariantListItem[];
  product_option_axes?: Array<{
    id: string;
    name: string;
    sort_order: number;
    is_required: boolean;
    product_option_values: Array<{
      id: string;
      value: string;
      sort_order: number;
      is_active: boolean;
    }>;
  }>;
};

export type DigitalProductPreview = {
  status: "missing" | "processing" | "ready" | "failed";
  sourceAssetVersionId: string | null;
  publicUrl: string | null;
  isMerchantOverride: boolean;
  failureReason: string | null;
};

export type OptionPairDraft = {
  name: string;
  value: string;
};

export type VariantDraft = {
  id?: string;
  /** Identifies a draft that has no row yet, so staged files can follow it. */
  draftKey?: string;
  title: string;
  sku: string;
  skuMode: "auto" | "manual";
  imageUrls: string[];
  groupImageUrls: string[];
  priceDollars: string;
  inventoryQty: string;
  isMadeToOrder: boolean;
  optionPairs: OptionPairDraft[];
  status: "active" | "archived";
  isDefault: boolean;
};

export const statusOptions: Array<ProductRecord["status"]> = ["draft", "active", "archived"];
export const variantStatusOptions: Array<ProductVariantListItem["status"]> = ["active", "archived"];

export function buildDigitalPublishReadinessView(readiness: DigitalProductReadiness) {
  return {
    ready: readiness.ready,
    applicableFileCount: readiness.applicableFileCount,
    previewStatus: readiness.previewStatus,
    blockers: readiness.reasons.map(digitalReadinessReasonLabel)
  };
}

export type CatalogInspectorTab = "overview" | "variants" | "inventory" | "media";

export type DigitalReadinessAction = {
  reason: DigitalProductReadiness["reasons"][number];
  label: string;
  /** "editor" opens the product editor at the unit that owns the file. */
  tab: "editor" | "media" | null;
  target: string;
};

export function buildDigitalReadinessActions(
  product: Pick<ProductListItem, "product_variants">,
  readiness: DigitalProductReadiness,
): DigitalReadinessAction[] {
  return readiness.reasons.map((reason) => {
    if (reason === "rights_missing") {
      return { reason, label: "Confirm distribution rights", tab: null, target: "rights" };
    }
    if (reason === "preview_not_ready") {
      return { reason, label: "Finish storefront preview", tab: "media", target: "preview" };
    }
    if (reason === "product_missing_file") {
      return { reason, label: "Attach a customer file", tab: "editor", target: "product" };
    }
    const variantId = reason.slice("variant_missing_file:".length);
    const variant = product.product_variants.find((candidate) => candidate.id === variantId);
    return {
      reason,
      label: `Attach a file to ${variant ? formatVariantLabelForReadiness(variant) : "the active variant"}`,
      tab: "editor",
      target: variantId,
    };
  });
}

function formatVariantLabelForReadiness(variant: ProductVariantListItem) {
  const values = Object.values(variant.option_values ?? {}).filter((value) => value.trim());
  return values.join(" · ") || variant.title?.trim() || "the active variant";
}

export function inspectorTabsForProduct(productType: ProductListItem["product_type"]): CatalogInspectorTab[] {
  // Customer files are provided beside the SKU for the unit they belong to,
  // so digital products no longer carry a separate files tab.
  return productType === "digital"
    ? ["overview", "variants", "media"]
    : ["overview", "variants", "inventory", "media"];
}

export function resolvePriceRange(variants: ProductVariantListItem[]) {
  if (variants.length === 0) {
    return "$0.00";
  }

  const prices = variants.map((variant) => variant.price_cents).sort((a, b) => a - b);
  const min = prices[0] ?? 0;
  const max = prices[prices.length - 1] ?? 0;

  if (min === max) {
    return `$${(min / 100).toFixed(2)}`;
  }

  return `$${(min / 100).toFixed(2)} - $${(max / 100).toFixed(2)}`;
}

export function hasStructuredVariants(product: ProductListItem) {
  const variants = product.product_variants ?? [];
  return variants.length > 1 || variants.some((variant) => Object.keys(variant.option_values ?? {}).length > 0);
}

export function resolveTierNamesForProduct(product: ProductListItem) {
  const axisTierNames = [...(product.product_option_axes ?? [])]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((axis) => axis.name.trim())
    .filter((name) => name.length > 0)
    .slice(0, 2);
  if (axisTierNames.length > 0) {
    return axisTierNames;
  }
  return Object.keys(product.product_variants?.[0]?.option_values ?? {})
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, 2);
}

export function normalizeTierDisplayLabel(label: string) {
  const trimmed = label.normalize("NFKC").trim();
  if (!trimmed) {
    return "";
  }
  const strippedLeading = trimmed.replace(/^[^\p{L}\p{N}]+/u, "");
  const strippedTrailing = strippedLeading.replace(/[^\p{L}\p{N}\s]+$/u, "").trim();
  return strippedTrailing;
}

export function sortVariants(variants: ProductVariantListItem[]) {
  return [...variants].sort((left, right) => {
    if (left.sort_order === right.sort_order) {
      return left.created_at.localeCompare(right.created_at);
    }

    return left.sort_order - right.sort_order;
  });
}

let draftKeyCounter = 0;

export function createBlankVariant(isDefault = false): VariantDraft {
  draftKeyCounter += 1;
  return {
    id: undefined,
    draftKey: `draft-${draftKeyCounter}`,
    title: "",
    sku: "",
    skuMode: "auto",
    imageUrls: [],
    groupImageUrls: [],
    priceDollars: "0.00",
    inventoryQty: "0",
    isMadeToOrder: false,
    optionPairs: [],
    status: "active",
    isDefault
  };
}

export function variantOptionInstruction(productType: ProductListItem["product_type"]) {
  return productType === "digital"
    ? "Add options for this variant, then configure price, SKU, and images for each option."
    : "Add options for this variant, then configure price, SKU, inventory, and images for each option.";
}

export function variantOptionSummary(
  productType: ProductListItem["product_type"],
  option: Pick<VariantDraft, "priceDollars" | "inventoryQty" | "status">,
) {
  const priceAndStatus = `$${option.priceDollars || "0.00"} · ${option.status}`;
  return productType === "digital"
    ? priceAndStatus
    : `$${option.priceDollars || "0.00"} · Inv ${option.inventoryQty || "0"} · ${option.status}`;
}
