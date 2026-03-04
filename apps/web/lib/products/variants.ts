export type VariantStatus = "active" | "archived";
export type VariantSkuMode = "auto" | "manual";

export type VariantInput = {
  id?: string | null;
  title?: string | null;
  sku?: string | null;
  skuMode?: VariantSkuMode;
  imageUrls?: string[];
  groupImageUrls?: string[];
  priceCents: number;
  inventoryQty: number;
  isMadeToOrder?: boolean;
  status?: VariantStatus;
  isDefault?: boolean;
  sortOrder?: number;
  optionValues?: Record<string, string>;
};

export type NormalizedVariantInput = {
  id: string | null;
  title: string | null;
  sku: string | null;
  sku_mode: VariantSkuMode;
  image_urls: string[];
  group_image_urls: string[];
  price_cents: number;
  inventory_qty: number;
  is_made_to_order: boolean;
  status: VariantStatus;
  is_default: boolean;
  sort_order: number;
  option_values: Record<string, string>;
};

export type ProductVariantRollup = {
  minPriceCents: number;
  totalInventoryQty: number;
  defaultSku: string | null;
};

function sanitizeOptionValues(values: Record<string, string> | undefined): Record<string, string> {
  if (!values) {
    return {};
  }

  const sanitizedEntries: Array<[string, string]> = [];

  for (const [rawKey, rawValue] of Object.entries(values)) {
    const key = rawKey.trim();
    const value = rawValue.trim();

    if (!key || !value) {
      continue;
    }

    sanitizedEntries.push([key, value]);
  }

  return Object.fromEntries(sanitizedEntries);
}

function buildVariantTitle(input: VariantInput): string | null {
  if (input.title && input.title.trim().length > 0) {
    return input.title.trim();
  }

  const optionValues = sanitizeOptionValues(input.optionValues);
  const optionParts = Object.values(optionValues);

  if (optionParts.length === 0) {
    return null;
  }

  return optionParts.join(" • ");
}

export function normalizeVariantInputs(
  inputs: VariantInput[],
  fallbackSku?: string | null,
  options?: { allowEmpty?: boolean; enforceValidation?: boolean }
): NormalizedVariantInput[] {
  const enforceValidation = options?.enforceValidation ?? true;
  const fallbackVariant: VariantInput = {
    title: null,
    sku: fallbackSku ?? null,
    skuMode: "auto",
    imageUrls: [],
    groupImageUrls: [],
    priceCents: 0,
    inventoryQty: 0,
    status: "active",
    isDefault: true,
    optionValues: {}
  };

  const source = inputs.length > 0 ? inputs : options?.allowEmpty ? [] : [fallbackVariant];

  let explicitDefaultIndex = source.findIndex((variant) => variant.isDefault);
  if (explicitDefaultIndex < 0) {
    explicitDefaultIndex = 0;
  }

  const normalized = source.map((variant, index) => {
    const explicitSku = variant.sku?.trim() || null;
    const fallbackBase = fallbackSku?.trim() || "VAR";
    const resolvedSku = explicitSku ?? `${fallbackBase}-${index + 1}`;
    const normalizedImageUrls = (variant.imageUrls ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const normalizedGroupImageUrls = (variant.groupImageUrls ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const imageUrls = [...new Set(normalizedImageUrls)];
    const groupImageUrls = [...new Set(normalizedGroupImageUrls)];

    return {
      id: variant.id?.trim() || null,
      title: buildVariantTitle(variant),
      sku: resolvedSku,
      sku_mode: (variant.skuMode === "manual" ? "manual" : "auto") as VariantSkuMode,
      image_urls: imageUrls,
      group_image_urls: groupImageUrls,
      price_cents: Math.max(0, Math.trunc(variant.priceCents)),
      inventory_qty: Math.max(0, Math.trunc(variant.inventoryQty)),
      is_made_to_order: Boolean(variant.isMadeToOrder),
      status: (variant.status === "archived" ? "archived" : "active") as VariantStatus,
      is_default: index === explicitDefaultIndex,
      sort_order: Number.isInteger(variant.sortOrder) ? (variant.sortOrder as number) : index,
      option_values: sanitizeOptionValues(variant.optionValues)
    };
  });

  const normalizedForValidation = !enforceValidation
    ? (() => {
        const seenSkus = new Set<string>();
        return normalized.map((variant) => {
          const normalizedSku = variant.sku?.toLowerCase() ?? null;
          if (!normalizedSku) {
            return variant;
          }

          if (seenSkus.has(normalizedSku)) {
            return { ...variant, sku: null };
          }

          seenSkus.add(normalizedSku);
          return variant;
        });
      })()
    : normalized;

  if (!enforceValidation) {
    return normalizedForValidation;
  }

  const activeVariants = normalizedForValidation.filter((variant) => variant.status === "active");
  const skuSeen = new Set<string>();
  const optionComboSeen = new Set<string>();
  const requiresOptionValues = normalizedForValidation.length > 1;

  for (const variant of activeVariants) {
    const normalizedSku = variant.sku?.toLowerCase();
    if (!normalizedSku) {
      throw new Error("Each active variant requires a SKU.");
    }
    if (skuSeen.has(normalizedSku)) {
      throw new Error(`Duplicate SKU detected: ${variant.sku}`);
    }
    skuSeen.add(normalizedSku);

    const optionEntries = Object.entries(variant.option_values ?? {});
    if (requiresOptionValues && optionEntries.length === 0) {
      throw new Error("When a product has multiple variants, each active variant must include option values.");
    }

    const optionSignature = JSON.stringify(
      Object.fromEntries([...optionEntries].sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)))
    );

    if (requiresOptionValues && optionComboSeen.has(optionSignature)) {
      throw new Error("Duplicate variant option combination detected.");
    }

    if (requiresOptionValues) {
      optionComboSeen.add(optionSignature);
    }
  }

  return normalizedForValidation;
}

export function buildProductVariantRollup(variants: NormalizedVariantInput[]): ProductVariantRollup {
  const activeVariants = variants.filter((variant) => variant.status === "active");
  const rollupSource = activeVariants.length > 0 ? activeVariants : variants;

  const minPriceCents = rollupSource.reduce(
    (current, variant) => Math.min(current, variant.price_cents),
    rollupSource[0]?.price_cents ?? 0
  );
  const totalInventoryQty = rollupSource.reduce((sum, variant) => sum + variant.inventory_qty, 0);
  const defaultSku = variants.find((variant) => variant.is_default)?.sku ?? null;

  return { minPriceCents, totalInventoryQty, defaultSku };
}

export function formatVariantLabel(
  variant: { title: string | null; option_values: Record<string, string> | null },
  fallback = "Default"
) {
  if (variant.title && variant.title.trim().length > 0) {
    return variant.title;
  }

  if (variant.option_values) {
    const optionValues = Object.values(variant.option_values).filter((value) => value.trim().length > 0);
    if (optionValues.length > 0) {
      return optionValues.join(" • ");
    }
  }

  return fallback;
}
