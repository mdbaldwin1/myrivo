import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequest } from "@/lib/stores/active-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99)
});

const upsertSchema = z.object({
  items: z.array(itemSchema)
});

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ guest: true, items: [] });
  }

  const storeSlug = resolveStoreSlugFromRequest(request);
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ items: [] });
  }

  const { data: cart, error: cartError } = await supabase
    .from("customer_carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("store_id", store.id)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (cartError) {
    return NextResponse.json({ error: cartError.message }, { status: 500 });
  }

  if (!cart) {
    return NextResponse.json({ items: [] });
  }

  const { data: items, error: itemsError } = await supabase
    .from("customer_cart_items")
    .select("product_id,product_variant_id,quantity")
    .eq("cart_id", cart.id)
    .returns<Array<{ product_id: string | null; product_variant_id: string | null; quantity: number }>>();

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (items ?? [])
      .filter((item) => Boolean(item.product_id))
      .map((item) => ({
        productId: item.product_id!,
        variantId: item.product_variant_id ?? undefined,
        quantity: item.quantity
      }))
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = upsertSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ guest: true, ok: true });
  }

  const storeSlug = resolveStoreSlugFromRequest(request);
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { data: existingCart, error: existingCartError } = await supabase
    .from("customer_carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("store_id", store.id)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (existingCartError) {
    return NextResponse.json({ error: existingCartError.message }, { status: 500 });
  }

  let cart = existingCart;

  if (!cart) {
    const { data: createdCart, error: createCartError } = await supabase
      .from("customer_carts")
      .insert({
        user_id: user.id,
        store_id: store.id,
        status: "active",
        metadata_json: {}
      })
      .select("id")
      .single<{ id: string }>();

    if (createCartError) {
      return NextResponse.json({ error: createCartError.message }, { status: 500 });
    }

    cart = createdCart;
  }

  const { error: clearError } = await supabase.from("customer_cart_items").delete().eq("cart_id", cart.id);
  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  if (payload.data.items.length > 0) {
    const { error: insertError } = await supabase.from("customer_cart_items").insert(
      payload.data.items.map((item) => ({
        cart_id: cart.id,
        product_id: item.productId,
        product_variant_id: item.variantId ?? null,
        quantity: item.quantity,
        unit_price_snapshot_cents: 0
      }))
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
