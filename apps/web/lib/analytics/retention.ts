export const STOREFRONT_ANALYTICS_RETENTION_POLICY = {
  rawEventDays: 180,
  sessionDays: 365,
  cleanupCadence: "weekly",
  rollupsRetention: "indefinite"
} as const;
