import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";

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
  price_cents: number;
  option_values: Record<string, string> | null;
  title: string | null;
};

type ProductRow = {
  id: string;
  title: string;
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

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; status: "draft" | "active" | "suspended" }>();

  if (storeError || !store || store.status !== "active") {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  const variantIds = [...new Set(payload.data.entries.map((entry) => entry.variantId))];
  const productIds = [...new Set(payload.data.entries.map((entry) => entry.productId))];

  const [{ data: variants, error: variantsError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id,product_id,price_cents,option_values,title")
      .eq("store_id", store.id)
      .in("id", variantIds),
    supabase
      .from("products")
      .select("id,title")
      .eq("store_id", store.id)
      .in("id", productIds)
  ]);

  if (variantsError || productsError) {
    return NextResponse.json({ items: [], subtotalCents: 0 });
  }

  const variantsById = new Map<string, VariantRow>((variants ?? []).map((variant) => [variant.id, variant as VariantRow]));
  const productsById = new Map<string, ProductRow>((products ?? []).map((product) => [product.id, product as ProductRow]));

  const items = payload.data.entries
    .map((entry) => {
      const variant = variantsById.get(entry.variantId);
      const product = productsById.get(entry.productId);
      if (!variant || !product || variant.product_id !== product.id) {
        return null;
      }

      const optionValues = Object.values(variant.option_values ?? {}).filter((value) => value.trim().length > 0);
      const variantLabel = optionValues.length > 0 ? optionValues.join(" · ") : variant.title?.trim() || "Default";

      return {
        key: `${entry.productId}:${entry.variantId}`,
        productTitle: product.title,
        variantLabel,
        quantity: entry.quantity,
        unitPriceCents: variant.price_cents,
        lineTotalCents: variant.price_cents * entry.quantity
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  return NextResponse.json({ items, subtotalCents });
}
