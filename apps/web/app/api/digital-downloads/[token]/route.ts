import { NextRequest, NextResponse } from "next/server";
import { hashDigitalAccessToken } from "@/lib/digital-products/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: access } = await admin.from("digital_order_access_tokens").select("id,order_id,expires_at,revoked_at").eq("token_hash", hashDigitalAccessToken(token)).maybeSingle();
  if (!access || access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This access link is invalid or expired." }, { status: 410 });
  const { data, error } = await admin.from("digital_order_entitlements").select("id,customer_filename,byte_size,mime_type,download_grants_used,max_download_grants,status").eq("order_id", access.order_id).order("created_at");
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ orderId: access.order_id, accessTokenId: access.id, files: data ?? [] });
}
