import { createHash, randomBytes } from "node:crypto";
import { getExternalAppUrl, getServerEnv } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_PRODUCT_CONFIG, DIGITAL_PERSONAL_USE_LICENSE_VERSION } from "./config";

export function hashDigitalAccessToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function issueDigitalEntitlements(orderId: string) {
  const admin = createSupabaseAdminClient();
  const { data: order, error } = await admin.from("orders").select("id,store_id,customer_email,stores(name),order_items(id,product_id,product_variant_id,products(product_type))").eq("id", orderId).single();
  if (error || !order) throw new Error(error?.message ?? "Order not found");
  const items = (order.order_items ?? []) as Array<{ id: string; product_id: string; product_variant_id: string | null; products: { product_type?: string } | Array<{ product_type?: string }> | null }>;
  let entitlementCount = 0;
  for (const item of items) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (product?.product_type !== "digital") continue;
    await admin.from("order_items").update({ product_type: "digital" }).eq("id", item.id);
    const { data: assets, error: assetsError } = await admin.from("digital_product_assets").select("id,product_variant_id,digital_product_asset_versions(id,customer_filename,mime_type,byte_size,status,version_number)").eq("product_id", item.product_id).eq("active", true);
    if (assetsError) throw new Error(assetsError.message);
    for (const asset of assets ?? []) {
      if (asset.product_variant_id && asset.product_variant_id !== item.product_variant_id) continue;
      const versions = asset.digital_product_asset_versions as Array<{ id: string; customer_filename: string; mime_type: string; byte_size: number; status: string; version_number: number }>;
      const version = versions.filter((entry) => entry.status === "ready").sort((a,b) => b.version_number-a.version_number)[0];
      if (!version) continue;
      const { error: entitlementError } = await admin.from("digital_order_entitlements").upsert({ store_id: order.store_id, order_id: order.id, order_item_id: item.id, product_id: item.product_id, product_variant_id: item.product_variant_id, asset_id: asset.id, asset_version_id: version.id, customer_filename: version.customer_filename, mime_type: version.mime_type, byte_size: version.byte_size, license_version: DIGITAL_PERSONAL_USE_LICENSE_VERSION, max_download_grants: DIGITAL_PRODUCT_CONFIG.grantsPerFile }, { onConflict: "order_item_id,asset_version_id", ignoreDuplicates: true });
      if (entitlementError) throw new Error(entitlementError.message);
      entitlementCount += 1;
    }
  }
  if (!entitlementCount) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 60 * 60 * 1000);
  const { error: tokenError } = await admin.from("digital_order_access_tokens").insert({ order_id: order.id, token_hash: hashDigitalAccessToken(token), issuance_reason: "purchase", expires_at: expiresAt.toISOString() });
  if (tokenError) throw new Error(tokenError.message);
  const url = `${getExternalAppUrl()}/downloads/${token}`;
  const sender = getServerEnv().MYRIVO_EMAIL_PLATFORM_FROM?.trim() || getServerEnv().MYRIVO_EMAIL_FROM?.trim();
  if (sender && order.customer_email) await sendTransactionalEmail({ from: sender, to: [order.customer_email], subject: "Your digital downloads are ready", text: `Download your purchase: ${url}\n\nThis secure link expires in 48 hours. You may request a fresh link using your order email. Personal-use license applies.` });
  return { url, expiresAt, entitlementCount };
}
