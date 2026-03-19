import { logAuditEvent } from "@/lib/audit/log";
import { buildProductSlug, normalizeProductSlug } from "@/lib/products/slug";
import { buildProductVariantRollup, normalizeVariantInputs } from "@/lib/products/variants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OnboardingFirstProductAnswers } from "@/lib/onboarding/workflow";

function buildOnboardingSkuBase(title: string) {
  const normalized = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "PRODUCT";
}

function parsePriceCents(priceDollars: string) {
  const parsed = Number(priceDollars.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

async function ensureUniqueProductSlug(storeId: string, title: string) {
  const admin = createSupabaseAdminClient();
  const base = normalizeProductSlug(title) || "product";

  for (let suffix = 1; suffix <= 200; suffix += 1) {
    const candidate = buildProductSlug(base, suffix);
    const { data, error } = await admin.from("products").select("id").eq("store_id", storeId).eq("slug", candidate).limit(1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique product slug.");
}

export async function saveOnboardingFirstProduct(input: {
  storeId: string;
  userId: string;
  existingProductId?: string | null;
  firstProduct: OnboardingFirstProductAnswers;
}) {
  const admin = createSupabaseAdminClient();
  const title = input.firstProduct.title.trim();

  if (title.length < 2) {
    throw new Error("Give the first product a name before continuing.");
  }

  const description = input.firstProduct.description.trim();
  const priceCents = parsePriceCents(input.firstProduct.priceDollars);
  const variants = normalizeVariantInputs(
    [
      {
        title: null,
        sku: null,
        skuMode: "auto",
        imageUrls: [],
        groupImageUrls: [],
        priceCents,
        inventoryQty: 0,
        isMadeToOrder: input.firstProduct.inventoryMode === "made_to_order",
        status: "active",
        isDefault: true,
        optionValues: {}
      }
    ],
    buildOnboardingSkuBase(title),
    { allowEmpty: false, enforceValidation: false }
  );
  const rollup = buildProductVariantRollup(variants);

  if (input.existingProductId) {
    const { data: existingProduct, error: existingProductError } = await admin
      .from("products")
      .select("id,slug")
      .eq("id", input.existingProductId)
      .eq("store_id", input.storeId)
      .maybeSingle<{ id: string; slug: string }>();

    if (existingProductError) {
      throw new Error(existingProductError.message);
    }

    if (existingProduct) {
      const { error: updateProductError } = await admin
        .from("products")
        .update({
          title,
          description,
          price_cents: rollup.minPriceCents,
          inventory_qty: rollup.totalInventoryQty,
          status: "draft"
        })
        .eq("id", existingProduct.id)
        .eq("store_id", input.storeId);

      if (updateProductError) {
        throw new Error(updateProductError.message);
      }

      const { data: existingVariant, error: existingVariantError } = await admin
        .from("product_variants")
        .select("id")
        .eq("store_id", input.storeId)
        .eq("product_id", existingProduct.id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (existingVariantError) {
        throw new Error(existingVariantError.message);
      }

      const defaultVariant = variants[0];
      if (!defaultVariant) {
        throw new Error("Unable to prepare the onboarding variant.");
      }

      if (existingVariant) {
        const { error: updateVariantError } = await admin
          .from("product_variants")
          .update({
            title: defaultVariant.title,
            sku: defaultVariant.sku,
            sku_mode: defaultVariant.sku_mode,
            image_urls: defaultVariant.image_urls,
            group_image_urls: defaultVariant.group_image_urls,
            price_cents: defaultVariant.price_cents,
            inventory_qty: defaultVariant.inventory_qty,
            is_made_to_order: defaultVariant.is_made_to_order,
            status: defaultVariant.status,
            is_default: true,
            sort_order: 0,
            option_values: defaultVariant.option_values
          })
          .eq("id", existingVariant.id)
          .eq("store_id", input.storeId)
          .eq("product_id", existingProduct.id);

        if (updateVariantError) {
          throw new Error(updateVariantError.message);
        }
      } else {
        const { error: insertVariantError } = await admin.from("product_variants").insert({
          store_id: input.storeId,
          product_id: existingProduct.id,
          title: defaultVariant.title,
          sku: defaultVariant.sku,
          sku_mode: defaultVariant.sku_mode,
          image_urls: defaultVariant.image_urls,
          group_image_urls: defaultVariant.group_image_urls,
          price_cents: defaultVariant.price_cents,
          inventory_qty: defaultVariant.inventory_qty,
          is_made_to_order: defaultVariant.is_made_to_order,
          status: defaultVariant.status,
          is_default: true,
          sort_order: 0,
          option_values: defaultVariant.option_values
        });

        if (insertVariantError) {
          throw new Error(insertVariantError.message);
        }
      }

      await logAuditEvent({
        storeId: input.storeId,
        actorUserId: input.userId,
        action: "update",
        entity: "product",
        entityId: existingProduct.id,
        metadata: {
          source: "onboarding_first_product",
          title,
          priceCents: rollup.minPriceCents
        }
      });

      return {
        productId: existingProduct.id,
        productTitle: title
      };
    }
  }

  const slug = await ensureUniqueProductSlug(input.storeId, title);
  const { data: createdProduct, error: createProductError } = await admin
    .from("products")
    .insert({
      store_id: input.storeId,
      title,
      description,
      slug,
      sku: null,
      image_urls: [],
      image_alt_text: null,
      seo_title: title,
      seo_description: description || null,
      is_featured: false,
      price_cents: rollup.minPriceCents,
      inventory_qty: rollup.totalInventoryQty,
      status: "draft"
    })
    .select("id")
    .single<{ id: string }>();

  if (createProductError || !createdProduct) {
    throw new Error(createProductError?.message ?? "Unable to create onboarding product.");
  }

  const defaultVariant = variants[0];
  if (!defaultVariant) {
    throw new Error("Unable to prepare the onboarding variant.");
  }

  const { error: createVariantError } = await admin.from("product_variants").insert({
    store_id: input.storeId,
    product_id: createdProduct.id,
    title: defaultVariant.title,
    sku: defaultVariant.sku,
    sku_mode: defaultVariant.sku_mode,
    image_urls: defaultVariant.image_urls,
    group_image_urls: defaultVariant.group_image_urls,
    price_cents: defaultVariant.price_cents,
    inventory_qty: defaultVariant.inventory_qty,
    is_made_to_order: defaultVariant.is_made_to_order,
    status: defaultVariant.status,
    is_default: true,
    sort_order: 0,
    option_values: defaultVariant.option_values
  });

  if (createVariantError) {
    await admin.from("products").delete().eq("id", createdProduct.id).eq("store_id", input.storeId);
    throw new Error(createVariantError.message);
  }

  await logAuditEvent({
    storeId: input.storeId,
    actorUserId: input.userId,
    action: "create",
    entity: "product",
    entityId: createdProduct.id,
    metadata: {
      source: "onboarding_first_product",
      title,
      priceCents: rollup.minPriceCents
    }
  });

  return {
    productId: createdProduct.id,
    productTitle: title
  };
}
