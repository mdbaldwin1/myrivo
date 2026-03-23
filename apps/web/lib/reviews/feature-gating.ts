type EnvMap = Record<string, string | undefined>;

function normalizeStoreSlug(value: string) {
  return value.trim().toLowerCase();
}

export function resolveReviewsRolloutConfig(env: EnvMap = process.env) {
  const allowlist = new Set(
    (env.REVIEWS_ROLLOUT_STORE_SLUGS ?? "")
      .split(",")
      .map((entry) => normalizeStoreSlug(entry))
      .filter(Boolean)
  );

  return {
    allowlist
  };
}

export function isReviewsEnabledForStoreSlug(storeSlug: string, env: EnvMap = process.env) {
  const config = resolveReviewsRolloutConfig(env);
  if (config.allowlist.size === 0) {
    return true;
  }

  return config.allowlist.has(normalizeStoreSlug(storeSlug));
}
