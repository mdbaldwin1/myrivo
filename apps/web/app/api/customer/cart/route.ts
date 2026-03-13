import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedCustomerUser,
  requireStoreBySlug,
  validateStoreItemSelection
} from "@/lib/customer/account";
import { resolveStorefrontSessionLink } from "@/lib/analytics/session-linking";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99)
});

const attributionTouchSchema = z.object({
  entryPath: z.string().trim().max(512).optional(),
  referrerUrl: z.string().trim().max(1024).optional(),
  referrerHost: z.string().trim().max(255).optional(),
  utmSource: z.string().trim().max(255).optional(),
  utmMedium: z.string().trim().max(255).optional(),
  utmCampaign: z.string().trim().max(255).optional(),
  utmTerm: z.string().trim().max(255).optional(),
  utmContent: z.string().trim().max(255).optional()
});

const upsertSchema = z.object({
  items: z.array(itemSchema),
  analyticsSessionId: z.string().trim().min(16).max(128).optional(),
  attribution: z
    .object({
      firstTouch: attributionTouchSchema.optional(),
      lastTouch: attributionTouchSchema.optional()
    })
    .optional()
});
const deleteSchema = z.object({
  cartId: z.string().uuid()
});

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return NextResponse.json({ guest: true, items: [] });
  }

  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ items: [] });
  }
  const storeLookup = await requireStoreBySlug(supabase, storeSlug);
  if (storeLookup.response) {
    return NextResponse.json({ items: [] });
  }

  const { data: cart, error: cartError } = await supabase
    .from("customer_carts")
    .select("id,created_at")
    .eq("user_id", auth.user.id)
    .eq("store_id", storeLookup.store.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
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

  const payload = await parseJsonRequest(request, upsertSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return NextResponse.json({ guest: true, ok: true });
  }

  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }
  const storeLookup = await requireStoreBySlug(supabase, storeSlug);
  if (storeLookup.response) {
    return storeLookup.response;
  }

  const { data: existingCart, error: existingCartError } = await supabase
    .from("customer_carts")
    .select("id,created_at,metadata_json,analytics_session_id,analytics_session_key")
    .eq("user_id", auth.user.id)
    .eq("store_id", storeLookup.store.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      metadata_json: Record<string, unknown> | null;
      analytics_session_id: string | null;
      analytics_session_key: string | null;
    }>();

  if (existingCartError) {
    return NextResponse.json({ error: existingCartError.message }, { status: 500 });
  }

  let cart = existingCart;

  if (!cart) {
    const sessionLink = await resolveStorefrontSessionLink(supabase, {
      storeId: storeLookup.store.id,
      sessionKey: payload.data.analyticsSessionId
    });

    const { data: createdCart, error: createCartError } = await supabase
      .from("customer_carts")
      .insert({
        user_id: auth.user.id,
        store_id: storeLookup.store.id,
        status: "active",
        metadata_json: {},
        analytics_session_id: sessionLink?.id ?? null,
        analytics_session_key: sessionLink?.sessionKey ?? null
      })
      .select("id,metadata_json,analytics_session_id,analytics_session_key")
      .single<{
        id: string;
        metadata_json: Record<string, unknown> | null;
        analytics_session_id: string | null;
        analytics_session_key: string | null;
      }>();

    if (createCartError) {
      return NextResponse.json({ error: createCartError.message }, { status: 500 });
    }

    cart = createdCart;
  }

  if (!cart) {
    return NextResponse.json({ error: "Unable to resolve an active cart." }, { status: 500 });
  }

  const sessionLink =
    (await resolveStorefrontSessionLink(supabase, {
      storeId: storeLookup.store.id,
      sessionKey: payload.data.analyticsSessionId ?? cart.analytics_session_key
    })) ??
    (cart.analytics_session_id && cart.analytics_session_key
      ? {
          id: cart.analytics_session_id,
          sessionKey: cart.analytics_session_key
        }
      : null);

  const nextMetadata = {
    ...(cart.metadata_json ?? {}),
    analytics: {
      sessionId: sessionLink?.sessionKey ?? payload.data.analyticsSessionId ?? null,
      attribution: payload.data.attribution ?? null,
      updatedAt: new Date().toISOString()
    }
  };

  const { error: metadataError } = await supabase
    .from("customer_carts")
    .update({
      metadata_json: nextMetadata,
      analytics_session_id: sessionLink?.id ?? cart.analytics_session_id ?? null,
      analytics_session_key: sessionLink?.sessionKey ?? cart.analytics_session_key ?? null
    })
    .eq("id", cart.id)
    .eq("user_id", auth.user.id);

  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
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

export async function DELETE(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const url = new URL(request.url);
  const query = deleteSchema.safeParse({
    cartId: url.searchParams.get("cartId")
  });
  if (!query.success) {
    return NextResponse.json({ error: "Valid cartId is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return auth.response;
  }

  const { data: cart, error: cartError } = await supabase
    .from("customer_carts")
    .select("id")
    .eq("id", query.data.cartId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (cartError) {
    return NextResponse.json({ error: cartError.message }, { status: 500 });
  }

  if (!cart) {
    return NextResponse.json({ error: "Active cart not found." }, { status: 404 });
  }

  const { error: clearError } = await supabase.from("customer_cart_items").delete().eq("cart_id", cart.id);
  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { error: cartUpdateError } = await supabase
    .from("customer_carts")
    .update({
      status: "abandoned",
      metadata_json: {}
    })
    .eq("id", cart.id)
    .eq("user_id", auth.user.id);

  if (cartUpdateError) {
    return NextResponse.json({ error: cartUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
