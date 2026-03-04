import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z
  .object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    deltaQty: z.number().int().refine((value) => value !== 0),
    reason: z.enum(["restock", "adjustment"]),
    note: z.string().max(280).nullable().optional()
  })
  .refine((value) => Boolean(value.productId || value.variantId), {
    message: "productId or variantId is required"
  });

const productSelect =
  "id,title,description,sku,image_urls,is_featured,price_cents,inventory_qty,status,created_at,product_variants(id,title,sku,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))";

type ProductWithVariantsRow = {
  id: string;
  title: string;
  description: string;
  sku: string | null;
  image_urls: string[];
  is_featured: boolean;
  price_cents: number;
  inventory_qty: number;
  status: "draft" | "active" | "archived";
  created_at: string;
  product_variants: Array<{
    id: string;
    title: string | null;
    sku: string | null;
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

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = payloadSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  let targetVariant:
    | {
        id: string;
        product_id: string;
        inventory_qty: number;
        title: string | null;
      }
    | null = null;

  if (payload.data.variantId) {
    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .select("id,product_id,inventory_qty,title")
      .eq("id", payload.data.variantId)
      .eq("store_id", bundle.store.id)
      .maybeSingle<{
        id: string;
        product_id: string;
        inventory_qty: number;
        title: string | null;
      }>();

    if (variantError) {
      return NextResponse.json({ error: variantError.message }, { status: 500 });
    }

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    targetVariant = variant;
  } else if (payload.data.productId) {
    const { data: defaultVariant, error: defaultVariantError } = await supabase
      .from("product_variants")
      .select("id,product_id,inventory_qty,title")
      .eq("product_id", payload.data.productId)
      .eq("store_id", bundle.store.id)
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: string;
        product_id: string;
        inventory_qty: number;
        title: string | null;
      }>();

    if (defaultVariantError) {
      return NextResponse.json({ error: defaultVariantError.message }, { status: 500 });
    }

    if (!defaultVariant) {
      return NextResponse.json({ error: "Product has no variants to adjust." }, { status: 404 });
    }

    targetVariant = defaultVariant;
  }

  if (!targetVariant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const nextInventory = targetVariant.inventory_qty + payload.data.deltaQty;

  if (nextInventory < 0) {
    return NextResponse.json({ error: "Inventory adjustment cannot make stock negative." }, { status: 400 });
  }

  const { error: updateVariantError } = await supabase
    .from("product_variants")
    .update({ inventory_qty: nextInventory })
    .eq("id", targetVariant.id)
    .eq("store_id", bundle.store.id)
    .eq("product_id", targetVariant.product_id);

  if (updateVariantError) {
    return NextResponse.json({ error: updateVariantError.message }, { status: 500 });
  }

  const { data: aggregate, error: aggregateError } = await supabase
    .from("product_variants")
    .select("price_cents,inventory_qty,status,sku,is_default")
    .eq("store_id", bundle.store.id)
    .eq("product_id", targetVariant.product_id)
    .returns<Array<{ price_cents: number; inventory_qty: number; status: "active" | "archived"; sku: string | null; is_default: boolean }>>();

  if (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  const activeVariants = (aggregate ?? []).filter((variant) => variant.status === "active");
  const source = activeVariants.length > 0 ? activeVariants : aggregate ?? [];
  const minPriceCents = source.reduce((min, variant) => Math.min(min, variant.price_cents), source[0]?.price_cents ?? 0);
  const totalInventoryQty = source.reduce((sum, variant) => sum + variant.inventory_qty, 0);
  const defaultSku = (aggregate ?? []).find((variant) => variant.is_default)?.sku ?? null;

  const { error: updateProductError } = await supabase
    .from("products")
    .update({
      price_cents: minPriceCents,
      inventory_qty: totalInventoryQty,
      sku: defaultSku
    })
    .eq("id", targetVariant.product_id)
    .eq("store_id", bundle.store.id);

  if (updateProductError) {
    return NextResponse.json({ error: updateProductError.message }, { status: 500 });
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    store_id: bundle.store.id,
    product_id: targetVariant.product_id,
    product_variant_id: targetVariant.id,
    delta_qty: payload.data.deltaQty,
    reason: payload.data.reason,
    note: payload.data.note ?? null
  });

  if (movementError) {
    return NextResponse.json({ error: movementError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "adjust",
    entity: "inventory",
    entityId: targetVariant.id,
    metadata: {
      reason: payload.data.reason,
      deltaQty: payload.data.deltaQty,
      nextInventory,
      productId: targetVariant.product_id,
      variantId: targetVariant.id
    }
  });

  const { data: updatedProduct, error: updatedProductError } = await supabase
    .from("products")
    .select(productSelect)
    .eq("id", targetVariant.product_id)
    .eq("store_id", bundle.store.id)
    .single<ProductWithVariantsRow>();

  if (updatedProductError || !updatedProduct) {
    return NextResponse.json({ error: updatedProductError?.message ?? "Unable to fetch updated product." }, { status: 500 });
  }

  updatedProduct.product_variants.sort((left, right) => {
    if (left.sort_order === right.sort_order) {
      return left.created_at.localeCompare(right.created_at);
    }
    return left.sort_order - right.sort_order;
  });

  updatedProduct.product_option_axes = [...(updatedProduct.product_option_axes ?? [])]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((axis) => ({
      ...axis,
      product_option_values: [...(axis.product_option_values ?? [])]
        .filter((value) => value.is_active)
        .sort((left, right) => left.sort_order - right.sort_order)
    }));

  return NextResponse.json({ product: updatedProduct });
}
