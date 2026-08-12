import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DIGITAL_ASSET_BUCKET } from "@/lib/digital-products/assets";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { hashDigitalAccessToken } from "@/lib/digital-products/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_: NextRequest, context: { params: Promise<{ token: string; entitlementId: string }> }) {
  const { token, entitlementId } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: access } = await admin.from("digital_order_access_tokens").select("id,order_id,expires_at,revoked_at").eq("token_hash", hashDigitalAccessToken(token)).maybeSingle();
  if (!access || access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This access link is invalid or expired." }, { status: 410 });
  const { data: entitlement } = await admin.from("digital_order_entitlements").select("id").eq("id", entitlementId).eq("order_id", access.order_id).maybeSingle();
  if (!entitlement) return NextResponse.json({ error: "Download unavailable." }, { status: 404 });
  const { data, error } = await admin.rpc("reserve_digital_download_grant", { p_entitlement_id: entitlementId, p_access_token_id: access.id, p_reservation_key: randomUUID() });
  const grant = Array.isArray(data) ? data[0] : data;
  if (error || !grant?.storage_path) return NextResponse.json({ error: error?.message ?? "Download unavailable." }, { status: 409 });
  const { data: signed, error: signedError } = await admin.storage.from(DIGITAL_ASSET_BUCKET).createSignedUrl(grant.storage_path, DIGITAL_PRODUCT_CONFIG.signedDownloadTtlSeconds, { download: grant.customer_filename });
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: signedError?.message ?? "Unable to prepare download." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 303);
}
