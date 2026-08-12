import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function authorize() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return user ? getOwnedStoreBundle(user.id, "staff") : null;
}

export async function GET(request: NextRequest) {
  const bundle = await authorize();
  if (!bundle) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const productId = request.nextUrl.searchParams.get("productId");
  if (!z.string().uuid().safeParse(productId).success) return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("digital_product_assets").select("id,label,product_variant_id,sort_order,active,digital_product_asset_versions(id,customer_filename,mime_type,byte_size,status,version_number,created_at)").eq("store_id", bundle.store.id).eq("product_id", productId!).eq("active", true).order("sort_order");
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ assets: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const bundle = await authorize();
  if (!bundle) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { assetId?: string } | null;
  if (!z.string().uuid().safeParse(body?.assetId).success) return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("digital_product_assets").update({ active: false }).eq("id", body!.assetId!).eq("store_id", bundle.store.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
}
