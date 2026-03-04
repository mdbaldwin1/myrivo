import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { buildProductVariantRollup, normalizeVariantInputs, type VariantInput } from "@/lib/products/variants";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nestedOptionSchema = z.object({
  id: z.string().uuid().optional(),
  optionValue: z.string().max(120).optional().default(""),
  sku: z.string().max(120).nullable().optional(),
  skuMode: z.enum(["auto", "manual"]).optional().default("auto"),
  imageUrls: z.array(z.string().url()).optional().default([]),
  priceCents: z.number().int().nonnegative().optional().default(0),
  inventoryQty: z.number().int().nonnegative().optional().default(0),
  isMadeToOrder: z.boolean().optional().default(false),
  status: z.enum(["active", "archived"]).optional().default("active"),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional()
});

const nestedVariantSchema = z.object({
  id: z.string().uuid().optional(),
  optionValue: z.string().max(120).optional().default(""),
  sku: z.string().max(120).nullable().optional(),
  skuMode: z.enum(["auto", "manual"]).optional().default("auto"),
  imageUrls: z.array(z.string().url()).optional().default([]),
  priceCents: z.number().int().nonnegative().optional().default(0),
  inventoryQty: z.number().int().nonnegative().optional().default(0),
  isMadeToOrder: z.boolean().optional().default(false),
  status: z.enum(["active", "archived"]).optional().default("active"),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional(),
  options: z.array(nestedOptionSchema).optional().default([])
});

type NestedVariantPayload = z.infer<typeof nestedVariantSchema>;

const createProductSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(1),
  sku: z.string().max(120).nullable().optional(),
  imageUrls: z.array(z.string().url()).optional().default([]),
  isFeatured: z.boolean().optional().default(false),
  hasVariants: z.boolean(),
  variantTiersCount: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  variantTierLevels: z.array(z.string().max(120)).max(2),
  priceCents: z.number().int().nonnegative().optional(),
  inventoryQty: z.number().int().nonnegative().optional(),
  variants: z.array(nestedVariantSchema)
});

const updateProductSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().min(2).optional(),
  description: z.string().min(1).optional(),
  sku: z.string().max(120).nullable().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  isFeatured: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  variantTiersCount: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  variantTierLevels: z.array(z.string().max(120)).max(2).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  inventoryQty: z.number().int().nonnegative().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  variants: z.array(nestedVariantSchema).optional()
});

const deleteProductSchema = z.object({
  productId: z.string().uuid()
});

const productSelectWithVariantImages =
  "id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,sku_mode,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";
const productSelectWithVariantImagesLegacy =
  "id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,sku_mode,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";

type ProductWithVariantsRow = {
  id: string;
  title: string;
  description: string;
  sku: string | null;
  image_urls: string[] | null;
  is_featured: boolean;
  price_cents: number;
  inventory_qty: number;
  status: "draft" | "active" | "archived";
  created_at: string;
  product_variants: Array<{
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
  }>;
  product_option_axes: Array<{
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

class VariantConflictError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toVariantInsertRow(storeId: string, productId: string, variant: ReturnType<typeof normalizeVariantInputs>[number]) {
  return {
    ...(variant.id ? { id: variant.id } : {}),
    store_id: storeId,
    product_id: productId,
    title: variant.title,
    sku: variant.sku,
    sku_mode: variant.sku_mode,
    image_urls: variant.image_urls,
    group_image_urls: variant.group_image_urls,
    price_cents: variant.price_cents,
    inventory_qty: variant.inventory_qty,
    is_made_to_order: variant.is_made_to_order,
    status: variant.status,
    is_default: variant.is_default,
    sort_order: variant.sort_order,
    option_values: variant.option_values
  };
}

function toVariantInsertRowLegacy(storeId: string, productId: string, variant: ReturnType<typeof normalizeVariantInputs>[number]) {
  const { is_made_to_order, ...legacy } = toVariantInsertRow(storeId, productId, variant);
  void is_made_to_order;
  return legacy;
}

function normalizeRequestVariantInputs(payload: {
  variants?: NestedVariantPayload[];
  hasVariants?: boolean;
  variantTiersCount?: 0 | 1 | 2;
  variantTierLevels?: string[];
  sku?: string | null;
  priceCents?: number;
  inventoryQty?: number;
}) {
  if (payload.hasVariants === false) {
    const baseVariant = payload.variants?.[0];
    return [
      {
        id: baseVariant?.id ?? null,
        title: null,
        sku: baseVariant?.sku ?? payload.sku ?? null,
        skuMode: baseVariant?.skuMode ?? "auto",
        imageUrls: baseVariant?.imageUrls ?? [],
        groupImageUrls: [],
        priceCents: baseVariant?.priceCents ?? payload.priceCents ?? 0,
        inventoryQty: baseVariant?.inventoryQty ?? payload.inventoryQty ?? 0,
        isMadeToOrder: baseVariant?.isMadeToOrder ?? false,
        status: baseVariant?.status ?? "active",
        isDefault: true,
        sortOrder: 0,
        optionValues: {}
      }
    ] satisfies VariantInput[];
  }

  if (!payload.variants) {
    return [] satisfies VariantInput[];
  }

  if (payload.variants.length === 0) {
    return [] satisfies VariantInput[];
  }

  const tierCount = payload.variantTiersCount ?? 1;
  const tierOneName = payload.variantTierLevels?.[0]?.trim() || "Option 1";
  const tierTwoName = payload.variantTierLevels?.[1]?.trim() || "Option 2";

  if (tierCount === 0) {
    return [] satisfies VariantInput[];
  }

  if (tierCount === 1) {
    return payload.variants.map((raw, index) => {
      const variant = raw;
      const optionOneValue = variant.optionValue?.trim() || `${tierOneName} ${index + 1}`;
      return {
        id: variant.id ?? null,
        title: optionOneValue,
        sku: variant.sku ?? null,
        skuMode: variant.skuMode ?? "auto",
        imageUrls: variant.imageUrls ?? [],
        groupImageUrls: [],
        priceCents: variant.priceCents ?? 0,
        inventoryQty: variant.inventoryQty ?? 0,
        isMadeToOrder: variant.isMadeToOrder ?? false,
        status: variant.status ?? "active",
        isDefault: variant.isDefault ?? index === 0,
        sortOrder: variant.sortOrder ?? index,
        optionValues: { [tierOneName]: optionOneValue }
      };
    });
  }

  const flattened: VariantInput[] = [];
  payload.variants.forEach((raw, variantIndex) => {
    const variant = raw;
    const optionOneValue = variant.optionValue?.trim() || `${tierOneName} ${variantIndex + 1}`;
    const children = variant.options ?? [];
    if (children.length === 0) {
      flattened.push({
        id: variant.id ?? null,
        title: optionOneValue,
        sku: variant.sku ?? null,
        skuMode: variant.skuMode ?? "auto",
        imageUrls: [],
        groupImageUrls: variant.imageUrls ?? [],
        priceCents: variant.priceCents ?? 0,
        inventoryQty: variant.inventoryQty ?? 0,
        isMadeToOrder: variant.isMadeToOrder ?? false,
        status: variant.status ?? "active",
        isDefault: variant.isDefault ?? variantIndex === 0,
        sortOrder: variant.sortOrder ?? variantIndex,
        optionValues: { [tierOneName]: optionOneValue }
      });
      return;
    }

    children.forEach((option, optionIndex) => {
      const optionTwoValue = option.optionValue?.trim() || `${tierTwoName} ${optionIndex + 1}`;
      flattened.push({
        id: option.id ?? null,
        title: `${optionOneValue} • ${optionTwoValue}`,
        sku: option.sku ?? null,
        skuMode: option.skuMode ?? "auto",
        imageUrls: option.imageUrls ?? [],
        groupImageUrls: variant.imageUrls ?? [],
        priceCents: option.priceCents ?? variant.priceCents ?? 0,
        inventoryQty: option.inventoryQty ?? variant.inventoryQty ?? 0,
        isMadeToOrder: option.isMadeToOrder ?? variant.isMadeToOrder ?? false,
        status: option.status ?? variant.status ?? "active",
        isDefault: option.isDefault ?? ((variant.isDefault ?? false) && optionIndex === 0),
        sortOrder: option.sortOrder ?? flattened.length,
        optionValues: {
          [tierOneName]: optionOneValue,
          [tierTwoName]: optionTwoValue
        }
      });
    });
  });

  return flattened;
}

function hasMadeToOrderEnabled(variants?: NestedVariantPayload[]) {
  if (!variants || variants.length === 0) {
    return false;
  }

  for (const variant of variants) {
    if (variant.isMadeToOrder) {
      return true;
    }
    for (const option of variant.options ?? []) {
      if (option.isMadeToOrder) {
        return true;
      }
    }
  }

  return false;
}

function extractDuplicateSkuFromMessage(message: string) {
  const match = message.match(/lower\(sku\)\)=\([^,]+,\s*([^)]+)\)/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/^"+|"+$/g, "").trim() || null;
}

function formatDuplicateSkuErrorMessage(message: string) {
  const sku = extractDuplicateSkuFromMessage(message);

  if (message.includes("idx_products_store_sku_unique")) {
    return sku
      ? `Product SKU "${sku}" is already used by another product in this store.`
      : "Product SKU is already used by another product in this store.";
  }

  if (message.includes("idx_product_variants_store_sku_unique")) {
    return sku
      ? `Variant SKU "${sku}" is already used by another variant in this store.`
      : "Variant SKU is already used by another variant in this store.";
  }

  return "Duplicate SKU detected. SKUs must be unique (case-insensitive) across this store.";
}

async function assertProductCanBeActive(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  storeId: string,
  productId: string
) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("sku")
    .eq("id", productId)
    .eq("store_id", storeId)
    .single<{ sku: string | null }>();
  if (productError || !product) {
    throw new Error(productError?.message ?? "Product not found.");
  }

  let { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id,title,sku,sku_mode,image_urls,group_image_urls,price_cents,inventory_qty,is_made_to_order,status,is_default,sort_order,option_values")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .returns<
      Array<{
        id: string;
        title: string | null;
        sku: string | null;
        sku_mode: "auto" | "manual";
        image_urls: string[] | null;
        group_image_urls: string[] | null;
        price_cents: number;
        inventory_qty: number;
        is_made_to_order: boolean;
        status: "active" | "archived";
        is_default: boolean;
        sort_order: number;
        option_values: Record<string, string> | null;
      }>
    >();

  if (isMissingColumnInSchemaCache(variantsError, "is_made_to_order")) {
    const legacy = await supabase
      .from("product_variants")
      .select("id,title,sku,sku_mode,image_urls,group_image_urls,price_cents,inventory_qty,status,is_default,sort_order,option_values")
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .returns<
        Array<{
          id: string;
          title: string | null;
          sku: string | null;
          sku_mode: "auto" | "manual";
          image_urls: string[] | null;
          group_image_urls: string[] | null;
          price_cents: number;
          inventory_qty: number;
          status: "active" | "archived";
          is_default: boolean;
          sort_order: number;
          option_values: Record<string, string> | null;
        }>
      >();
    variants = legacy.data
      ? legacy.data.map((variant) => ({ ...variant, is_made_to_order: false }))
      : null;
    variantsError = legacy.error;
  }

  if (variantsError) {
    throw new Error(variantsError.message);
  }

  if ((variants ?? []).length === 0) {
    if (!product.sku || product.sku.trim().length === 0) {
      throw new VariantConflictError("Active products without variants must include a product SKU.", 400);
    }
    return;
  }

  try {
    normalizeVariantInputs(
      (variants ?? []).map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        skuMode: variant.sku_mode,
        imageUrls: variant.image_urls ?? [],
        groupImageUrls: variant.group_image_urls ?? [],
        priceCents: variant.price_cents,
        inventoryQty: variant.inventory_qty,
        isMadeToOrder: variant.is_made_to_order,
        status: variant.status,
        isDefault: variant.is_default,
        sortOrder: variant.sort_order,
        optionValues: variant.option_values ?? {}
      })),
      null,
      { allowEmpty: true, enforceValidation: true }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Active products require valid variants.";
    throw new VariantConflictError(message, 400);
  }
}

async function rollbackCreatedProduct(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  storeId: string,
  productId: string
) {
  await supabase.from("products").delete().eq("id", productId).eq("store_id", storeId);
}

function normalizePayloadVariants(payload: {
  variants?: NestedVariantPayload[];
  hasVariants?: boolean;
  variantTiersCount?: 0 | 1 | 2;
  variantTierLevels?: string[];
  sku?: string | null;
  priceCents?: number;
  inventoryQty?: number;
}, options?: { enforceValidation?: boolean }) {
  const variantInputs = normalizeRequestVariantInputs(payload);
  return normalizeVariantInputs(variantInputs, payload.sku ?? null, {
    allowEmpty: true,
    enforceValidation: options?.enforceValidation
  });
}

async function selectProductWithVariants(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, productId: string, storeId: string) {
  let { data, error } = await supabase
    .from("products")
    .select(productSelectWithVariantImages)
    .eq("id", productId)
    .eq("store_id", storeId)
    .single<ProductWithVariantsRow>();

  if (isMissingColumnInSchemaCache(error, "is_made_to_order")) {
    const legacy = await supabase
      .from("products")
      .select(productSelectWithVariantImagesLegacy)
      .eq("id", productId)
      .eq("store_id", storeId)
      .single<
        Omit<ProductWithVariantsRow, "product_variants"> & {
          product_variants: Array<Omit<ProductWithVariantsRow["product_variants"][number], "is_made_to_order">>;
        }
      >();
    data = legacy.data as ProductWithVariantsRow | null;
    error = legacy.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Product not found.");
  }

  return {
    ...data,
    image_urls: data.image_urls ?? [],
    product_variants: [...(data.product_variants ?? [])]
      .map((variant) => ({ ...variant, is_made_to_order: variant.is_made_to_order ?? false }))
      .sort((a, b) => {
        if (a.sort_order === b.sort_order) {
          return a.created_at.localeCompare(b.created_at);
        }
        return a.sort_order - b.sort_order;
      }),
    product_option_axes: [...(data.product_option_axes ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((axis) => ({
        ...axis,
        product_option_values: [...(axis.product_option_values ?? [])]
          .filter((value) => value.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
      }))
  };
}

async function replaceProductVariants(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  storeId: string,
  productId: string,
  variants: VariantInput[],
  fallbackSku?: string | null,
  options?: { enforceValidation?: boolean; requireMadeToOrderSupport?: boolean }
) {
  const normalizedVariants = normalizeVariantInputs(variants, fallbackSku, {
    allowEmpty: true,
    enforceValidation: options?.enforceValidation
  });
  const rollup = buildProductVariantRollup(normalizedVariants);

  const { data: existingVariants, error: existingVariantsError } = await supabase
    .from("product_variants")
    .select("id,sku,option_values")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .returns<Array<{ id: string; sku: string | null; option_values: Record<string, string> | null }>>();

  if (existingVariantsError) {
    throw new Error(existingVariantsError.message);
  }

  const existingVariantRows = existingVariants ?? [];
  const existingVariantIds = new Set(existingVariantRows.map((variant) => variant.id));
  const existingVariantById = new Map(existingVariantRows.map((variant) => [variant.id, variant]));
  const submittedVariantIds = new Set(normalizedVariants.map((variant) => variant.id).filter((id): id is string => Boolean(id)));
  const unknownVariantIds = [...submittedVariantIds].filter((id) => !existingVariantIds.has(id));

  if (unknownVariantIds.length > 0) {
    throw new VariantConflictError("One or more submitted variants are no longer available. Refresh and try again.");
  }

  const { data: referencedVariantRows, error: referencedVariantError } = await supabase
    .from("order_items")
    .select("product_variant_id")
    .eq("product_id", productId)
    .in("product_variant_id", [...existingVariantIds])
    .returns<Array<{ product_variant_id: string | null }>>();

  if (referencedVariantError) {
    throw new Error(referencedVariantError.message);
  }

  const orderedVariantIds = new Set(
    (referencedVariantRows ?? []).map((row) => row.product_variant_id).filter((id): id is string => Boolean(id))
  );

  const canonicalizeOptionValues = (values: Record<string, string> | null | undefined) =>
    JSON.stringify(
      Object.entries(values ?? {})
        .map(([key, value]) => [key.trim(), value.trim()] as const)
        .filter(([key, value]) => key.length > 0 && value.length > 0)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    );

  for (const variant of normalizedVariants) {
    if (!variant.id || !orderedVariantIds.has(variant.id)) {
      continue;
    }

    const existingVariant = existingVariantById.get(variant.id);
    if (!existingVariant) {
      continue;
    }

    const existingSku = existingVariant.sku?.trim() ?? "";
    const nextSku = variant.sku?.trim() ?? "";
    if (existingSku !== nextSku) {
      throw new VariantConflictError("Variants with existing orders cannot change SKU.", 409);
    }

    const existingOptions = canonicalizeOptionValues(existingVariant.option_values);
    const nextOptions = canonicalizeOptionValues(variant.option_values);
    if (existingOptions !== nextOptions) {
      throw new VariantConflictError("Variants with existing orders cannot change option values.", 409);
    }
  }

  const { error: clearDefaultError } = await supabase
    .from("product_variants")
    .update({ is_default: false })
    .eq("store_id", storeId)
    .eq("product_id", productId);

  if (clearDefaultError) {
    throw new Error(clearDefaultError.message);
  }

  for (const variant of normalizedVariants) {
    if (variant.id && existingVariantIds.has(variant.id)) {
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          title: variant.title,
          sku: variant.sku,
          sku_mode: variant.sku_mode,
          image_urls: variant.image_urls,
          group_image_urls: variant.group_image_urls,
          price_cents: variant.price_cents,
          inventory_qty: variant.inventory_qty,
          is_made_to_order: variant.is_made_to_order,
          status: variant.status,
          is_default: variant.is_default,
          sort_order: variant.sort_order,
          option_values: variant.option_values
        })
        .eq("id", variant.id)
        .eq("store_id", storeId)
        .eq("product_id", productId);

      if (updateError) {
        if (isMissingColumnInSchemaCache(updateError, "is_made_to_order")) {
          if (options?.requireMadeToOrderSupport) {
            throw new VariantConflictError(
              "Made to order requires the latest database migration. Please run migrations and try again.",
              400
            );
          }
          const { error: legacyUpdateError } = await supabase
            .from("product_variants")
            .update({
              title: variant.title,
              sku: variant.sku,
              sku_mode: variant.sku_mode,
              image_urls: variant.image_urls,
              group_image_urls: variant.group_image_urls,
              price_cents: variant.price_cents,
              inventory_qty: variant.inventory_qty,
              status: variant.status,
              is_default: variant.is_default,
              sort_order: variant.sort_order,
              option_values: variant.option_values
            })
            .eq("id", variant.id)
            .eq("store_id", storeId)
            .eq("product_id", productId);
          if (legacyUpdateError) {
            throw new Error(legacyUpdateError.message);
          }
        } else {
          throw new Error(updateError.message);
        }
      }

      continue;
    }

    const { error: insertError } = await supabase.from("product_variants").insert(toVariantInsertRow(storeId, productId, variant));

    if (insertError) {
      if (isMissingColumnInSchemaCache(insertError, "is_made_to_order")) {
        if (options?.requireMadeToOrderSupport) {
          throw new VariantConflictError(
            "Made to order requires the latest database migration. Please run migrations and try again.",
            400
          );
        }
        const { error: legacyInsertError } = await supabase
          .from("product_variants")
          .insert(toVariantInsertRowLegacy(storeId, productId, variant));
        if (legacyInsertError) {
          throw new Error(legacyInsertError.message);
        }
      } else {
        throw new Error(insertError.message);
      }
    }
  }

  const staleVariantIds = [...existingVariantIds].filter((id) => !submittedVariantIds.has(id));

  if (staleVariantIds.length > 0) {
    const { count: referencedCount, error: referencedError } = await supabase
      .from("order_items")
      .select("id", { head: true, count: "exact" })
      .eq("product_id", productId)
      .in("product_variant_id", staleVariantIds);

    if (referencedError) {
      throw new Error(referencedError.message);
    }

    if ((referencedCount ?? 0) > 0) {
      throw new VariantConflictError(
        "One or more variants are referenced by existing orders and cannot be deleted. Archive those variants instead."
      );
    }

    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .in("id", staleVariantIds);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  return rollup;
}

async function rebuildProductOptionCatalog(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  storeId: string,
  productId: string,
  preferredAxisOrder: string[] = []
) {
  const { data: existingAxes, error: existingAxesError } = await supabase
    .from("product_option_axes")
    .select("name,sort_order")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .returns<Array<{ name: string; sort_order: number }>>();

  if (existingAxesError) {
    throw new Error(existingAxesError.message);
  }

  const fallbackAxisOrder = (existingAxes ?? [])
    .map((axis) => axis.name.trim())
    .filter((name) => name.length > 0);

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id,option_values,sort_order,created_at")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; option_values: Record<string, string> | null; sort_order: number; created_at: string }>>();

  if (variantsError) {
    throw new Error(variantsError.message);
  }

  const variantIds = (variants ?? []).map((variant) => variant.id);

  if (variantIds.length > 0) {
    const { error: deleteMappingsError } = await supabase
      .from("product_variant_option_values")
      .delete()
      .in("variant_id", variantIds);

    if (deleteMappingsError) {
      throw new Error(deleteMappingsError.message);
    }
  }

  const { error: deleteValuesError } = await supabase
    .from("product_option_values")
    .delete()
    .eq("store_id", storeId)
    .eq("product_id", productId);

  if (deleteValuesError) {
    throw new Error(deleteValuesError.message);
  }

  const { error: deleteAxesError } = await supabase
    .from("product_option_axes")
    .delete()
    .eq("store_id", storeId)
    .eq("product_id", productId);

  if (deleteAxesError) {
    throw new Error(deleteAxesError.message);
  }

  const axisOrder: string[] = [];
  const axisSet = new Set<string>();
  const axisValueOrder = new Map<string, string[]>();
  const variantOptionEntries: Array<{ variantId: string; axisName: string; optionValue: string }> = [];

  for (const variant of variants ?? []) {
    const entries = Object.entries(variant.option_values ?? {}).map(([rawName, rawValue]) => [rawName.trim(), rawValue.trim()] as const);

    for (const [axisName, optionValue] of entries) {
      if (!axisName || !optionValue) {
        continue;
      }

      if (!axisSet.has(axisName)) {
        axisSet.add(axisName);
        axisOrder.push(axisName);
      }

      const values = axisValueOrder.get(axisName) ?? [];
      if (!values.includes(optionValue)) {
        values.push(optionValue);
      }
      axisValueOrder.set(axisName, values);

      variantOptionEntries.push({
        variantId: variant.id,
        axisName,
        optionValue
      });
    }
  }

  const preferredAxisSource = preferredAxisOrder.length > 0 ? preferredAxisOrder : fallbackAxisOrder;
  const normalizedPreferredOrder = preferredAxisSource
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  if (normalizedPreferredOrder.length > 0) {
    const preferredIndex = new Map(normalizedPreferredOrder.map((name, index) => [name, index]));
    const originalIndex = new Map(axisOrder.map((name, index) => [name, index]));
    axisOrder.sort((left, right) => {
      const leftRank = preferredIndex.get(left.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = preferredIndex.get(right.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0);
    });
  }

  if (axisOrder.length === 0) {
    return;
  }

  const { data: insertedAxes, error: insertAxesError } = await supabase
    .from("product_option_axes")
    .insert(
      axisOrder.map((axisName, index) => ({
        store_id: storeId,
        product_id: productId,
        name: axisName,
        sort_order: index,
        is_required: true
      }))
    )
    .select("id,name")
    .returns<Array<{ id: string; name: string }>>();

  if (insertAxesError) {
    throw new Error(insertAxesError.message);
  }

  const axisIdByName = new Map((insertedAxes ?? []).map((axis) => [axis.name, axis.id]));
  const valuesToInsert: Array<{ axisId: string; value: string; sortOrder: number }> = [];

  for (const axisName of axisOrder) {
    const axisId = axisIdByName.get(axisName);
    if (!axisId) {
      continue;
    }

    const values = axisValueOrder.get(axisName) ?? [];

    values.forEach((value, index) => {
      valuesToInsert.push({
        axisId,
        value,
        sortOrder: index
      });
    });
  }

  if (valuesToInsert.length === 0) {
    return;
  }

  const { data: insertedValues, error: insertValuesError } = await supabase
    .from("product_option_values")
    .insert(
      valuesToInsert.map((entry) => ({
        store_id: storeId,
        product_id: productId,
        axis_id: entry.axisId,
        value: entry.value,
        sort_order: entry.sortOrder,
        is_active: true
      }))
    )
    .select("id,axis_id,value")
    .returns<Array<{ id: string; axis_id: string; value: string }>>();

  if (insertValuesError) {
    throw new Error(insertValuesError.message);
  }

  const valueIdByAxisAndValue = new Map((insertedValues ?? []).map((value) => [`${value.axis_id}:${value.value}`, value.id]));

  const mappingRows = variantOptionEntries
    .map((entry) => {
      const axisId = axisIdByName.get(entry.axisName);
      if (!axisId) {
        return null;
      }

      const valueId = valueIdByAxisAndValue.get(`${axisId}:${entry.optionValue}`);
      if (!valueId) {
        return null;
      }

      return {
        variant_id: entry.variantId,
        axis_id: axisId,
        value_id: valueId
      };
    })
    .filter((row): row is { variant_id: string; axis_id: string; value_id: string } => row !== null);

  if (mappingRows.length === 0) {
    return;
  }

  const { error: insertMappingsError } = await supabase.from("product_variant_option_values").insert(mappingRows);

  if (insertMappingsError) {
    throw new Error(insertMappingsError.message);
  }
}

async function resolveOwnedStoreId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return { error: NextResponse.json({ error: "No store found for account" }, { status: 404 }) } as const;
  }

  return { supabase, storeId: bundle.store.id, userId: user.id } as const;
}

export async function GET() {
  const resolved = await resolveOwnedStoreId();

  if ("error" in resolved) {
    return resolved.error;
  }

  let { data, error } = await resolved.supabase
    .from("products")
    .select(productSelectWithVariantImages)
    .eq("store_id", resolved.storeId)
    .order("created_at", { ascending: false })
    .returns<ProductWithVariantsRow[]>();

  if (isMissingColumnInSchemaCache(error, "is_made_to_order")) {
    const legacy = await resolved.supabase
      .from("products")
      .select(productSelectWithVariantImagesLegacy)
      .eq("store_id", resolved.storeId)
      .order("created_at", { ascending: false })
      .returns<
        Array<
          Omit<ProductWithVariantsRow, "product_variants"> & {
            product_variants: Array<Omit<ProductWithVariantsRow["product_variants"][number], "is_made_to_order">>;
          }
        >
      >();
    data = legacy.data as ProductWithVariantsRow[] | null;
    error = legacy.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (data ?? []).map((product) => ({
      ...product,
      image_urls: product.image_urls ?? [],
      product_variants: [...(product.product_variants ?? [])]
        .map((variant) => ({ ...variant, is_made_to_order: variant.is_made_to_order ?? false }))
        .sort((a, b) => {
          if (a.sort_order === b.sort_order) {
            return a.created_at.localeCompare(b.created_at);
          }
          return a.sort_order - b.sort_order;
        }),
      product_option_axes: [...(product.product_option_axes ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((axis) => ({
          ...axis,
          product_option_values: [...(axis.product_option_values ?? [])]
            .filter((value) => value.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
        }))
    }));

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, createProductSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnedStoreId();

  if ("error" in resolved) {
    return resolved.error;
  }

  let variants: ReturnType<typeof normalizePayloadVariants>;
  let rollup: ReturnType<typeof buildProductVariantRollup>;

  try {
    variants = normalizePayloadVariants({
      variants: payload.data.variants,
      hasVariants: payload.data.hasVariants,
      variantTiersCount: payload.data.variantTiersCount,
      variantTierLevels: payload.data.variantTierLevels,
      sku: payload.data.sku,
      priceCents: payload.data.priceCents,
      inventoryQty: payload.data.inventoryQty
    }, { enforceValidation: false });
    rollup = buildProductVariantRollup(variants);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process product variants.";
    const validationError =
      message.toLowerCase().includes("duplicate sku") ||
      message.toLowerCase().includes("duplicate variant") ||
      message.toLowerCase().includes("must include option values") ||
      message.toLowerCase().includes("requires a sku");
    return NextResponse.json({ error: message }, { status: validationError ? 400 : 500 });
  }

  const { supabase } = resolved;
  const priceFromVariants = variants.length > 0 ? rollup.minPriceCents : payload.data.priceCents ?? 0;
  const inventoryFromVariants = variants.length > 0 ? rollup.totalInventoryQty : payload.data.inventoryQty ?? 0;
  const productInsert = {
    store_id: resolved.storeId,
    title: payload.data.title,
    description: payload.data.description,
    sku: payload.data.hasVariants ? null : payload.data.sku ?? null,
    image_urls: payload.data.imageUrls,
    is_featured: payload.data.isFeatured,
    price_cents: priceFromVariants,
    inventory_qty: inventoryFromVariants,
    status: "draft" as const
  };
  const { data: createdProduct, error: productError } = await supabase
    .from("products")
    .insert(productInsert)
    .select("id")
    .single<{ id: string }>();

  if (productError || !createdProduct) {
    const message = productError?.message ?? "Unable to create product.";
    if (message.toLowerCase().includes("duplicate key value")) {
      return NextResponse.json({ error: formatDuplicateSkuErrorMessage(message) }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (variants.length > 0) {
    const madeToOrderRequested = hasMadeToOrderEnabled(payload.data.variants);
    let { error: variantsError } = await supabase.from("product_variants").insert(
      variants.map((variant) => toVariantInsertRow(resolved.storeId, createdProduct.id, variant))
    );

    if (isMissingColumnInSchemaCache(variantsError, "is_made_to_order")) {
      if (madeToOrderRequested) {
        await rollbackCreatedProduct(supabase, resolved.storeId, createdProduct.id);
        return NextResponse.json(
          { error: "Made to order requires the latest database migration. Please run migrations and try again." },
          { status: 400 }
        );
      }
      const legacyInsert = await supabase.from("product_variants").insert(
        variants.map((variant) => toVariantInsertRowLegacy(resolved.storeId, createdProduct.id, variant))
      );
      variantsError = legacyInsert.error;
    }

    if (variantsError) {
      if (variantsError.message.toLowerCase().includes("duplicate key value")) {
        await rollbackCreatedProduct(supabase, resolved.storeId, createdProduct.id);
        return NextResponse.json({ error: formatDuplicateSkuErrorMessage(variantsError.message) }, { status: 400 });
      }
      await rollbackCreatedProduct(supabase, resolved.storeId, createdProduct.id);
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }
  }

  try {
    await rebuildProductOptionCatalog(supabase, resolved.storeId, createdProduct.id, payload.data.variantTierLevels ?? []);
  } catch (catalogError) {
    await rollbackCreatedProduct(supabase, resolved.storeId, createdProduct.id);
    return NextResponse.json({ error: (catalogError as Error).message }, { status: 500 });
  }

  let product: Awaited<ReturnType<typeof selectProductWithVariants>>;
  try {
    product = await selectProductWithVariants(supabase, createdProduct.id, resolved.storeId);
  } catch (selectError) {
    await rollbackCreatedProduct(supabase, resolved.storeId, createdProduct.id);
    return NextResponse.json({ error: (selectError as Error).message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: resolved.storeId,
    actorUserId: resolved.userId,
    action: "create",
    entity: "product",
    entityId: product.id,
    metadata: {
      title: product.title,
      priceCents: product.price_cents,
      status: product.status,
      variantCount: product.product_variants.length
    }
  });

  return NextResponse.json({ product }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updateProductSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnedStoreId();

  if ("error" in resolved) {
    return resolved.error;
  }

  const { data: existingProduct, error: existingProductError } = await resolved.supabase
    .from("products")
    .select("status")
    .eq("id", payload.data.productId)
    .eq("store_id", resolved.storeId)
    .single<{ status: "draft" | "active" | "archived" }>();

  if (existingProductError || !existingProduct) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const nextStatus = payload.data.status ?? existingProduct.status;

  const updates: Record<string, unknown> = {};

  if (payload.data.title !== undefined) updates.title = payload.data.title;
  if (payload.data.description !== undefined) updates.description = payload.data.description;
  if (payload.data.sku !== undefined) updates.sku = payload.data.sku;
  if (payload.data.imageUrls !== undefined) updates.image_urls = payload.data.imageUrls;
  if (payload.data.isFeatured !== undefined) updates.is_featured = payload.data.isFeatured;
  if (payload.data.priceCents !== undefined) updates.price_cents = payload.data.priceCents;
  if (payload.data.inventoryQty !== undefined) updates.inventory_qty = payload.data.inventoryQty;
  if (payload.data.status !== undefined) updates.status = payload.data.status;

  let rollupFromVariants: ReturnType<typeof buildProductVariantRollup> | null = null;

  try {
    if (payload.data.variants) {
      const madeToOrderRequested = hasMadeToOrderEnabled(payload.data.variants);
      rollupFromVariants = await replaceProductVariants(
        resolved.supabase,
        resolved.storeId,
        payload.data.productId,
        normalizeRequestVariantInputs({
          variants: payload.data.variants,
          hasVariants: payload.data.hasVariants,
          variantTiersCount: payload.data.variantTiersCount,
          variantTierLevels: payload.data.variantTierLevels,
          sku: payload.data.sku,
          priceCents: payload.data.priceCents,
          inventoryQty: payload.data.inventoryQty
        }),
        payload.data.sku,
        { enforceValidation: nextStatus === "active", requireMadeToOrderSupport: madeToOrderRequested }
      );

      if (payload.data.hasVariants === false) {
        if (payload.data.priceCents !== undefined) {
          updates.price_cents = payload.data.priceCents;
        }
        if (payload.data.inventoryQty !== undefined) {
          updates.inventory_qty = payload.data.inventoryQty;
        }
        updates.sku = payload.data.sku ?? null;
      } else {
        updates.price_cents = rollupFromVariants.minPriceCents;
        updates.inventory_qty = rollupFromVariants.totalInventoryQty;
        updates.sku = null;
      }
    }

    if (payload.data.variants !== undefined || payload.data.variantTierLevels !== undefined) {
      await rebuildProductOptionCatalog(
        resolved.supabase,
        resolved.storeId,
        payload.data.productId,
        payload.data.variantTierLevels ?? []
      );
    }

    if (nextStatus === "active") {
      await assertProductCanBeActive(resolved.supabase, resolved.storeId, payload.data.productId);
    }
  } catch (error) {
    const message = (error as Error).message;
    if (error instanceof VariantConflictError) {
      return NextResponse.json({ error: message }, { status: error.statusCode });
    }
    if (message.toLowerCase().includes("duplicate key value")) {
      return NextResponse.json({ error: formatDuplicateSkuErrorMessage(message) }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { error: productError } = await resolved.supabase
    .from("products")
    .update(updates)
    .eq("id", payload.data.productId)
    .eq("store_id", resolved.storeId);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  const product = await selectProductWithVariants(resolved.supabase, payload.data.productId, resolved.storeId);

  await logAuditEvent({
    storeId: resolved.storeId,
    actorUserId: resolved.userId,
    action: "update",
    entity: "product",
    entityId: payload.data.productId,
    metadata: {
      ...updates,
      variantCount: product.product_variants.length,
      rolledUpFromVariants: Boolean(rollupFromVariants)
    }
  });

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, deleteProductSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnedStoreId();

  if ("error" in resolved) {
    return resolved.error;
  }

  const { data: product, error: productLookupError } = await resolved.supabase
    .from("products")
    .select("id,title")
    .eq("id", payload.data.productId)
    .eq("store_id", resolved.storeId)
    .single<{ id: string; title: string }>();

  if (productLookupError || !product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const { count: orderAssociationCount, error: orderAssociationError } = await resolved.supabase
    .from("order_items")
    .select("id", { head: true, count: "exact" })
    .eq("product_id", payload.data.productId);

  if (orderAssociationError) {
    return NextResponse.json({ error: orderAssociationError.message }, { status: 500 });
  }

  if ((orderAssociationCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "This product cannot be deleted because it is associated with one or more orders."
      },
      { status: 409 }
    );
  }

  const { error: deleteError } = await resolved.supabase
    .from("products")
    .delete()
    .eq("id", payload.data.productId)
    .eq("store_id", resolved.storeId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: resolved.storeId,
    actorUserId: resolved.userId,
    action: "delete",
    entity: "product",
    entityId: payload.data.productId,
    metadata: {
      title: product.title
    }
  });

  return NextResponse.json({ success: true });
}
