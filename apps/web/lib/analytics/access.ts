import type { SupabaseClient } from "@supabase/supabase-js";

type AnalyticsPlanRow = {
  billing_plans:
    | {
        key: string;
        feature_flags_json: Record<string, unknown> | null;
      }
    | Array<{
        key: string;
        feature_flags_json: Record<string, unknown> | null;
      }>
    | null;
};

export type StoreAnalyticsAccess = {
  planKey: string | null;
  planAllowsAnalytics: boolean;
  collectionEnabled: boolean;
  dashboardEnabled: boolean;
};

function normalizeBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }
  return value !== "0" && value.toLowerCase() !== "false";
}

export function getStorefrontAnalyticsRolloutConfig() {
  return {
    collectionEnabled: normalizeBooleanEnv(process.env.NEXT_PUBLIC_MYRIVO_STOREFRONT_ANALYTICS_ENABLED, true),
    dashboardEnabled: normalizeBooleanEnv(process.env.MYRIVO_ANALYTICS_DASHBOARD_ENABLED, true)
  };
}

export function resolveStorePlanAnalyticsFlag(featureFlags: Record<string, unknown> | null | undefined) {
  return featureFlags?.analytics === true;
}

export async function resolveStoreAnalyticsAccessByStoreId(
  supabase: SupabaseClient,
  storeId: string
): Promise<StoreAnalyticsAccess> {
  const rollout = getStorefrontAnalyticsRolloutConfig();
  const { data, error } = await supabase
    .from("store_billing_profiles")
    .select("billing_plans(key,feature_flags_json)")
    .eq("store_id", storeId)
    .maybeSingle<AnalyticsPlanRow>();

  if (error) {
    throw new Error(error.message);
  }

  const plan = Array.isArray(data?.billing_plans) ? data?.billing_plans[0] : data?.billing_plans;
  const planAllowsAnalytics = resolveStorePlanAnalyticsFlag((plan?.feature_flags_json as Record<string, unknown> | null | undefined) ?? null);

  return {
    planKey: plan?.key ?? null,
    planAllowsAnalytics,
    collectionEnabled: rollout.collectionEnabled && planAllowsAnalytics,
    dashboardEnabled: rollout.dashboardEnabled && planAllowsAnalytics
  };
}
