import type { SupabaseClient } from "@supabase/supabase-js";

export type ShippingProvider = "none" | "easypost";

export type ShippingConfig = {
  provider: ShippingProvider;
  apiKey: string | null;
  webhookSecret: string | null;
  source: "store" | "default";
};

function normalizeProvider(value: string | null | undefined): ShippingProvider {
  if (value === "easypost") {
    return "easypost";
  }

  return "none";
}

function normalizeSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getStoreShippingConfig(
  supabase: SupabaseClient,
  storeId: string,
  includeSecrets = true
): Promise<ShippingConfig> {
  const { data } = await supabase
    .from("store_integrations")
    .select("shipping_provider,shipping_api_key,shipping_webhook_secret")
    .eq("store_id", storeId)
    .maybeSingle<{
      shipping_provider: string;
      shipping_api_key: string | null;
      shipping_webhook_secret: string | null;
    }>();

  if (data) {
    return {
      provider: normalizeProvider(data.shipping_provider),
      apiKey: includeSecrets ? normalizeSecret(data.shipping_api_key) : null,
      webhookSecret: includeSecrets ? normalizeSecret(data.shipping_webhook_secret) : null,
      source: "store"
    };
  }

  return {
    provider: "none",
    apiKey: null,
    webhookSecret: null,
    source: "default"
  };
}

export async function getStoreIdsByWebhookSecret(supabase: SupabaseClient, secret: string): Promise<string[]> {
  const normalized = normalizeSecret(secret);

  if (!normalized) {
    return [];
  }

  const { data } = await supabase
    .from("store_integrations")
    .select("store_id")
    .eq("shipping_webhook_secret", normalized)
    .returns<Array<{ store_id: string }>>();

  return (data ?? []).map((row) => row.store_id);
}
