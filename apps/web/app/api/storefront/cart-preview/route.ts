import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { resolveStoreDigitalProductsAccess } from "@/lib/digital-products/feature-gating";

const previewSchema = z.object({
  entries: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99)
      })
    )
    .max(24)
});

type VariantRow = {
  id: string;
  product_id: string;
  status: "active" | "archived";
  price_cents: number;
  option_values: Record<string, string> | null;
  title: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  product_type: "physical" | "digital";
};

export async function POST(request: NextRequest) {
  const payload = previewSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  if (payload.data.entries.length === 0) {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  const supabase = createSupabaseAdminClient();
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (storeError || !store || !isStorePubliclyAccessibleStatus(store.status)) {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  const digitalProductsAccess = await resolveStoreDigitalProductsAccess(supabase, store.id)
    .catch(() => ({ enabled: false }));

  const variantIds = [...new Set(payload.data.entries.map((entry) => entry.variantId))];
  const productIds = [...new Set(payload.data.entries.map((entry) => entry.productId))];

  const [{ data: variants, error: variantsError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id,product_id,status,price_cents,option_values,title")
      .eq("store_id", store.id)
      .eq("status", "active")
      .in("id", variantIds),
    supabase
      .from("products")
      .select("id,title,status,product_type")
      .eq("store_id", store.id)
      .eq("status", "active")
      .in("id", productIds)
  ]);

  if (variantsError || productsError) {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  const variantsById = new Map<string, VariantRow>((variants ?? []).map((variant) => [variant.id, variant as VariantRow]));
  const productsById = new Map<string, ProductRow>((products ?? []).map((product) => [product.id, product as ProductRow]));

  const normalizedEntries = new Map<string, {
    productId: string;
    variantId: string;
    quantity: number;
    variant: VariantRow;
    product: ProductRow;
  }>();

  for (const entry of payload.data.entries) {
    const variant = variantsById.get(entry.variantId);
    const product = productsById.get(entry.productId);
    if (
      !variant ||
      !product ||
      variant.status !== "active" ||
      product.status !== "active" ||
      variant.product_id !== product.id
      || (product.product_type === "digital" && !digitalProductsAccess.enabled)
    ) {
      continue;
    }

    const key = `${entry.productId}:${entry.variantId}`;
    const existing = normalizedEntries.get(key);
    normalizedEntries.set(key, {
      productId: entry.productId,
      variantId: entry.variantId,
      variant,
      product,
      quantity: product.product_type === "digital"
        ? 1
        : Math.min(99, (existing?.quantity ?? 0) + entry.quantity)
    });
  }

  const items = [...normalizedEntries.values()]
    .map((entry) => {
      const { variant, product } = entry;

      const optionValues = Object.values(variant.option_values ?? {}).filter((value) => value.trim().length > 0);
      const variantLabel = optionValues.length > 0 ? optionValues.join(" · ") : variant.title?.trim() || "Default";

      return {
        key: `${entry.productId}:${entry.variantId}`,
        productId: entry.productId,
        variantId: entry.variantId,
        productTitle: product.title,
        variantLabel,
        productType: product.product_type,
        quantity: entry.quantity,
        unitPriceCents: variant.price_cents,
        lineTotalCents: variant.price_cents * entry.quantity
      };
    });

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  return NextResponse.json({ items, subtotalCents });
}
