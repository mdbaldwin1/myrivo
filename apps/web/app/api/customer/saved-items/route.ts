import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedCustomerUser,
  requireStoreById,
  validateStoreItemSelection
} from "@/lib/customer/account";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, createSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return auth.response;
  }

  const storeLookup = await requireStoreById(supabase, payload.data.storeId);
  if (storeLookup.response) {
    return storeLookup.response;
  }

  const selectionLookup = await validateStoreItemSelection(supabase, {
    storeId: payload.data.storeId,
    productId: payload.data.productId,
    variantId: payload.data.variantId
  });
  if (selectionLookup.response) {
    return selectionLookup.response;
  }

  const { error } = await supabase.from("customer_saved_items").upsert({
    user_id: auth.user.id,
    store_id: payload.data.storeId,
    product_id: selectionLookup.selection.productId,
    product_variant_id: selectionLookup.selection.variantId
  }, { onConflict: "user_id,store_id,product_id,product_variant_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireAuthenticatedCustomerUser(supabase);
  if (auth.response) {
    return auth.response;
  }

  const { error } = await supabase.from("customer_saved_items").delete().eq("id", id).eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
