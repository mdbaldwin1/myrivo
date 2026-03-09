import { ProductRecord } from "@/types/database";

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
  | "created_at"
> & {
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

export type OptionPairDraft = {
  name: string;
  value: string;
};

export type VariantDraft = {
  id?: string;
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

export function createBlankVariant(isDefault = false): VariantDraft {
  return {
    id: undefined,
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
