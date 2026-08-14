export const DIGITAL_PRODUCTS_FEATURE_KEY = "digitalProducts" as const;

type DigitalProductsStoreFlagRow = {
  digital_products?: unknown;
} | null | undefined;

type BillingPlanFeatureRow = {
  key?: unknown;
  active?: unknown;
  feature_flags_json?: unknown;
};

type StoreBillingProfileRow = {
  billing_plans?: BillingPlanFeatureRow | BillingPlanFeatureRow[] | null;
};

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

function asFeatureFlags(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePlan(
  value: StoreBillingProfileRow["billing_plans"],
): BillingPlanFeatureRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function isDigitalProductsEnabled(
  planFeatureFlags: Record<string, unknown> | null | undefined,
  storeFeatureFlags: DigitalProductsStoreFlagRow,
) {
  return (
    planFeatureFlags?.[DIGITAL_PRODUCTS_FEATURE_KEY] === true &&
    storeFeatureFlags?.digital_products === true
  );
}

export async function resolveStoreDigitalProductsAccess(
  client: DigitalProductsFeatureGateClient,
  storeId: string,
): Promise<StoreDigitalProductsAccess> {
  const [storeResult, billingResult] = await Promise.all([
    (client.from("store_feature_flags") as unknown as FeatureGateQuery<DigitalProductsStoreFlagRow>)
      .select("digital_products")
      .eq("store_id", storeId)
      .maybeSingle(),
    (client.from("store_billing_profiles") as unknown as FeatureGateQuery<StoreBillingProfileRow>)
      .select("billing_plans(key,active,feature_flags_json)")
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);

  const error = storeResult.error ?? billingResult.error;
  if (error) {
    throw new Error(error.message || "Digital product rollout configuration could not be loaded");
  }

  const plan = normalizePlan(billingResult.data?.billing_plans);
  const planFlags = asFeatureFlags(plan?.feature_flags_json);
  const planEligible = plan?.active === true
    && planFlags?.[DIGITAL_PRODUCTS_FEATURE_KEY] === true;
  const storeEnabled = storeResult.data?.digital_products === true;

  return {
    enabled: planEligible && storeEnabled,
    planEligible,
    storeEnabled,
    planKey: typeof plan?.key === "string" ? plan.key : null,
  };
}
