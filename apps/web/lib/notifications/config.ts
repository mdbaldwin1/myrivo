function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const notificationConfig = {
  lowStockThreshold: readPositiveIntegerEnv("NOTIFICATIONS_LOW_STOCK_THRESHOLD", 10),
  alertDedupeWindowHours: readPositiveIntegerEnv("NOTIFICATIONS_ALERT_DEDUPE_WINDOW_HOURS", 24),
  dispatchIdempotencyWindowMinutes: readPositiveIntegerEnv("NOTIFICATIONS_DISPATCH_IDEMPOTENCY_WINDOW_MINUTES", 30),
  dispatchThrottleWindowMinutes: readPositiveIntegerEnv("NOTIFICATIONS_DISPATCH_THROTTLE_WINDOW_MINUTES", 30),
  dispatchThrottleMaxPerWindow: readPositiveIntegerEnv("NOTIFICATIONS_DISPATCH_THROTTLE_MAX_PER_WINDOW", 12),
  emailRetryAttempts: readPositiveIntegerEnv("NOTIFICATIONS_EMAIL_RETRY_ATTEMPTS", 3),
  emailRetryBaseDelayMs: readPositiveIntegerEnv("NOTIFICATIONS_EMAIL_RETRY_BASE_DELAY_MS", 300)
};

export function getNotificationDedupeBucketKey(date = new Date()) {
  const dedupeWindowMs = Math.max(1, notificationConfig.alertDedupeWindowHours) * 60 * 60 * 1000;
  const bucketStartEpoch = Math.floor(date.getTime() / dedupeWindowMs);
  return String(bucketStartEpoch);
}
