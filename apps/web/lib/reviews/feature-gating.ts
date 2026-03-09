type EnvMap = Record<string, string | undefined>;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeStoreSlug(value: string) {
  return value.trim().toLowerCase();
}

export function resolveReviewsRolloutConfig(env: EnvMap = process.env) {
  const enabled = parseBoolean(env.REVIEWS_FEATURE_ENABLED, true);
  const allowlist = new Set(
    (env.REVIEWS_ROLLOUT_STORE_SLUGS ?? "")
      .split(",")
      .map((entry) => normalizeStoreSlug(entry))
      .filter(Boolean)
  );

  return {
    enabled,
    allowlist
  };
}

export function isReviewsEnabledForStoreSlug(storeSlug: string, env: EnvMap = process.env) {
  const config = resolveReviewsRolloutConfig(env);
  if (!config.enabled) {
    return false;
  }
  if (config.allowlist.size === 0) {
    return true;
  }

  return config.allowlist.has(normalizeStoreSlug(storeSlug));
}
