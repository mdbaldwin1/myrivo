import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedCustomerUser,
  requireStoreBySlug,
  validateStoreItemSelection
} from "@/lib/customer/account";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
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
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return NextResponse.json({ guest: true, items: [] });
  }

  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  const storeLookup = await requireStoreBySlug(supabase, storeSlug);
  if (storeLookup.response) {
    return NextResponse.json({ items: [] });
  }

  const { data: cart, error: cartError } = await supabase
    .from("customer_carts")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("store_id", storeLookup.store.id)
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
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return NextResponse.json({ guest: true, ok: true });
  }

  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  const storeLookup = await requireStoreBySlug(supabase, storeSlug);
  if (storeLookup.response) {
    return storeLookup.response;
  }

  const { data: existingCart, error: existingCartError } = await supabase
    .from("customer_carts")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("store_id", storeLookup.store.id)
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
        user_id: auth.user.id,
        store_id: storeLookup.store.id,
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

  const normalizedSelections = [];
  for (const item of payload.data.items) {
    const selectionLookup = await validateStoreItemSelection(supabase, {
      storeId: storeLookup.store.id,
      productId: item.productId,
      variantId: item.variantId
    });
    if (selectionLookup.response) {
      return selectionLookup.response;
    }

    normalizedSelections.push({
      productId: selectionLookup.selection.productId,
      variantId: selectionLookup.selection.variantId,
      quantity: item.quantity,
      unitPriceSnapshotCents: selectionLookup.selection.unitPriceSnapshotCents
    });
  }

  const mergedSelections = new Map<string, { productId: string | null; variantId: string | null; quantity: number; unitPriceSnapshotCents: number }>();
  for (const selection of normalizedSelections) {
    const key = `${selection.productId ?? ""}::${selection.variantId ?? ""}`;
    const existing = mergedSelections.get(key);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + selection.quantity);
      continue;
    }
    mergedSelections.set(key, { ...selection });
  }

  const { error: clearError } = await supabase.from("customer_cart_items").delete().eq("cart_id", cart.id);
  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  if (mergedSelections.size > 0) {
    const { error: insertError } = await supabase.from("customer_cart_items").insert(
      [...mergedSelections.values()].map((item) => ({
        cart_id: cart.id,
        product_id: item.productId,
        product_variant_id: item.variantId ?? null,
        quantity: item.quantity,
        unit_price_snapshot_cents: item.unitPriceSnapshotCents
      }))
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
