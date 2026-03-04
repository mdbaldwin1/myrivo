import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  productId: z.string().uuid(),
  variantIds: z.array(z.string().uuid()).min(1)
});

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

  return { supabase, storeId: bundle.store.id } as const;
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const parsed = await parseJsonRequest(request, payloadSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const resolved = await resolveOwnedStoreId();
  if ("error" in resolved) {
    return resolved.error;
  }

  const { productId, variantIds } = parsed.data;
  const uniqueVariantIds = [...new Set(variantIds)];

  const { data: ownedVariants, error: ownedVariantsError } = await resolved.supabase
    .from("product_variants")
    .select("id")
    .eq("store_id", resolved.storeId)
    .eq("product_id", productId)
    .in("id", uniqueVariantIds)
    .returns<Array<{ id: string }>>();

  if (ownedVariantsError) {
    return NextResponse.json({ error: ownedVariantsError.message }, { status: 500 });
  }

  const ownedVariantIds = new Set((ownedVariants ?? []).map((variant) => variant.id));
  const unknownVariantIds = uniqueVariantIds.filter((id) => !ownedVariantIds.has(id));
  if (unknownVariantIds.length > 0) {
    return NextResponse.json(
      {
        error: "One or more selected variants are no longer available. Refresh and try again."
      },
      { status: 409 }
    );
  }

  const { data: linkedItems, error: linkedItemsError } = await resolved.supabase
    .from("order_items")
    .select("product_variant_id")
    .eq("product_id", productId)
    .in("product_variant_id", uniqueVariantIds)
    .returns<Array<{ product_variant_id: string | null }>>();

  if (linkedItemsError) {
    return NextResponse.json({ error: linkedItemsError.message }, { status: 500 });
  }

  const blockedVariantIds = [...new Set((linkedItems ?? []).map((item) => item.product_variant_id).filter((id): id is string => Boolean(id)))];

  if (blockedVariantIds.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        blockedVariantIds,
        error: "One or more variants are referenced by existing orders and cannot be deleted. Archive those variants instead."
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, blockedVariantIds: [] });
}
