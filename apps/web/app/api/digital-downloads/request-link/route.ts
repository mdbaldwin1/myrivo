import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { hashDigitalAccessToken } from "@/lib/digital-products/entitlements";
import { getExternalAppUrl, getServerEnv } from "@/lib/env";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ orderId: z.string().uuid(), email: z.string().email() });
export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request); if (originFailure) return originFailure;
  const limited = await checkRateLimit(request, { key: "digital-link-request", limit: 5, windowMs: 60_000 }); if (limited) return limited;
  const parsed = await parseJsonRequest(request, schema); if (!parsed.ok) return parsed.response;
  const response = NextResponse.json({ success: true, message: "If the order details match, a fresh link will arrive by email." });
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin.from("orders").select("id,customer_email,digital_order_entitlements(id)").eq("id", parsed.data.orderId).ilike("customer_email", parsed.data.email).maybeSingle();
  if (!order || !(order.digital_order_entitlements as unknown[] | null)?.length) return response;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 3600_000);
  await admin.from("digital_order_access_tokens").insert({ order_id: order.id, token_hash: hashDigitalAccessToken(token), issuance_reason: "customer_request", expires_at: expiresAt.toISOString() });
  const sender = getServerEnv().MYRIVO_EMAIL_PLATFORM_FROM?.trim() || getServerEnv().MYRIVO_EMAIL_FROM?.trim();
  if (sender) await sendTransactionalEmail({ from: sender, to: [order.customer_email], subject: "Your fresh download link", text: `${getExternalAppUrl()}/downloads/${token}\n\nThis secure link expires in 48 hours.` });
  return response;
}
