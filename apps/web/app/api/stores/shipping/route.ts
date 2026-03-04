import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/env";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getStoreShippingConfig } from "@/lib/shipping/store-config";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  shippingProvider: z.enum(["none", "easypost"]),
  shippingApiKey: z.string().trim().max(300).nullable().optional(),
  shippingWebhookSecret: z.string().trim().max(300).nullable().optional(),
  regenerateWebhookSecret: z.boolean().optional()
});

function createWebhookSecret() {
  return `ship_${randomBytes(18).toString("hex")}`;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const config = await getStoreShippingConfig(supabase, bundle.store.id, true);

  return NextResponse.json({
    shippingProvider: config.provider,
    hasApiKey: Boolean(config.apiKey),
    hasWebhookSecret: Boolean(config.webhookSecret),
    webhookSecret: config.webhookSecret,
    webhookUrl: `${getAppUrl()}/api/shipping/webhook?token=${encodeURIComponent(config.webhookSecret ?? "")}`,
    source: config.source
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, settingsSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const current = await getStoreShippingConfig(supabase, bundle.store.id, true);

  const webhookSecret = payload.data.regenerateWebhookSecret
    ? createWebhookSecret()
    : payload.data.shippingWebhookSecret?.trim() || current.webhookSecret || createWebhookSecret();

  const shippingApiKey = payload.data.shippingApiKey?.trim() ?? current.apiKey;

  const { error } = await supabase.from("store_integrations").upsert(
    {
      store_id: bundle.store.id,
      shipping_provider: payload.data.shippingProvider,
      shipping_api_key: shippingApiKey,
      shipping_webhook_secret: webhookSecret
    },
    { onConflict: "store_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    shippingProvider: payload.data.shippingProvider,
    hasApiKey: Boolean(shippingApiKey),
    hasWebhookSecret: Boolean(webhookSecret),
    webhookSecret,
    webhookUrl: `${getAppUrl()}/api/shipping/webhook?token=${encodeURIComponent(webhookSecret)}`,
    source: "store"
  });
}
