export const DIGITAL_PRODUCTS_FEATURE_KEY = "digitalProducts" as const;

type DigitalProductsStoreFlagRow = {
  digital_products?: unknown;
} | null | undefined;

type FeatureGateQueryResult<T> = PromiseLike<{
  data: T | null;
  error: { message?: string } | null;
}>;

type FeatureGateQuery<T> = {
  select: (columns: string) => FeatureGateQuery<T>;
  eq: (column: string, value: string) => FeatureGateQuery<T>;
  maybeSingle: () => FeatureGateQueryResult<T>;
};

export type DigitalProductsFeatureGateClient = {
  from: (table: string) => unknown;
};

export type StoreDigitalProductsAccess = {
  enabled: boolean;
  planEligible: boolean;
  storeEnabled: boolean;
  planKey: string | null;
};

export function isDigitalProductsEnabled(storeFeatureFlags: DigitalProductsStoreFlagRow) {
  return storeFeatureFlags?.digital_products !== false;
}

export async function resolveStoreDigitalProductsAccess(
  client: DigitalProductsFeatureGateClient,
  storeId: string,
): Promise<StoreDigitalProductsAccess> {
  const storeResult = await (client.from("store_feature_flags") as unknown as FeatureGateQuery<DigitalProductsStoreFlagRow>)
    .select("digital_products")
    .eq("store_id", storeId)
    .maybeSingle();

  if (storeResult.error) {
    throw new Error(storeResult.error.message || "Digital product rollout configuration could not be loaded");
  }

  // Digital products are generally available: a store is enabled unless it has
  // explicitly opted out, so a store with no flag row yet is on.
  const storeEnabled = storeResult.data?.digital_products !== false;

  return {
    enabled: storeEnabled,
    planEligible: true,
    storeEnabled,
    planKey: null,
  };
}
