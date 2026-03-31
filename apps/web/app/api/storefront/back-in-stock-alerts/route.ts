import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

const createSchema = z.object({
  email: z.string().email().max(320),
  storeSlug: z.string().trim().max(120).optional(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  source: z.string().trim().max(80).optional().default("storefront_product_detail"),
  location: z.string().trim().max(400).optional().default("")
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "back-in-stock-alert",
    limit: 10,
    windowMs: 60_000
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = await parseJsonRequest(request, createSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const requestedStoreSlug = parsed.data.storeSlug?.trim().toLowerCase() || null;
  const storeSlug = requestedStoreSlug || (await resolveStoreSlugFromRequestAsync(request));
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const email = parsed.data.email.trim().toLowerCase();

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,slug,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }
  if (!store || !isStorePubliclyAccessibleStatus(store.status)) {
    return NextResponse.json({ error: "Back-in-stock alerts are not available right now." }, { status: 400 });
  }

  const { data: variant, error: variantError } = await admin
    .from("product_variants")
    .select("id,product_id,inventory_qty,is_made_to_order,status")
    .eq("id", parsed.data.variantId)
    .eq("product_id", parsed.data.productId)
    .eq("store_id", store.id)
    .maybeSingle<{ id: string; product_id: string; inventory_qty: number; is_made_to_order: boolean; status: "active" | "archived" }>();

  if (variantError) {
    return NextResponse.json({ error: variantError.message }, { status: 500 });
  }
  if (!variant || variant.status !== "active") {
    return NextResponse.json({ error: "Variant not found." }, { status: 404 });
  }
  if (variant.is_made_to_order || variant.inventory_qty > 0) {
    return NextResponse.json({ error: "This variant is already available." }, { status: 400 });
  }

  const metadata = {
    consent_location: parsed.data.location.trim() || null,
    consent_source: parsed.data.source.trim() || "storefront_product_detail",
    consent_captured_at: new Date().toISOString()
  };

  const { data: existing, error: existingError } = await admin
    .from("back_in_stock_alerts")
    .select("id,status,alert_count,metadata_json")
    .eq("store_id", store.id)
    .eq("product_id", parsed.data.productId)
    .eq("product_variant_id", parsed.data.variantId)
    .ilike("email", email)
    .maybeSingle<{ id: string; status: "pending" | "sent" | "cancelled"; alert_count: number; metadata_json: Record<string, unknown> | null }>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.status === "pending") {
      return NextResponse.json({ success: true, alreadyRequested: true });
    }

    const { error: updateError } = await admin
      .from("back_in_stock_alerts")
      .update({
        status: "pending",
        source: parsed.data.source.trim() || "storefront_product_detail",
        requested_at: metadata.consent_captured_at,
        metadata_json: {
          ...(existing.metadata_json ?? {}),
          ...metadata
        }
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reactivated: true });
  }

  const { error: insertError } = await admin.from("back_in_stock_alerts").insert({
    store_id: store.id,
    product_id: parsed.data.productId,
    product_variant_id: parsed.data.variantId,
    email,
    status: "pending",
    source: parsed.data.source.trim() || "storefront_product_detail",
    requested_at: metadata.consent_captured_at,
    metadata_json: metadata
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
