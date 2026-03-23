export type BillingPlanRow = {
  key: string;
  name: string;
  monthly_price_cents: number;
  transaction_fee_bps: number;
  transaction_fee_fixed_cents: number;
  active: boolean;
  feature_flags_json: Record<string, unknown> | null;
};

export type PricingPlan = {
  key: string;
  name: string;
  monthlyPriceCents: number;
  feeBps: number;
  feeFixedCents: number;
  recommended: boolean;
  highlights: string[];
  featureFlags: {
    prioritySupport: boolean;
    customDomain: boolean;
    whiteLabel: boolean;
    internalOnly: boolean;
  };
};

const planHighlights: Record<string, string[]> = {
  standard: [
    "High-touch storefront, checkout, and seller operations",
    "Branded commerce experience with no required monthly base",
    "Single all-in Myrivo fee that covers Stripe processing"
  ],
  family_friends: [
    "Internal-use plan for close-circle stores",
    "Covers baseline Stripe processing without extra Myrivo margin",
    "Assigned by the Myrivo team only"
  ]
};

const fallbackPlans: BillingPlanRow[] = [
  {
    key: "standard",
    name: "Standard",
    monthly_price_cents: 0,
    transaction_fee_bps: 600,
    transaction_fee_fixed_cents: 30,
    active: true,
    feature_flags_json: { prioritySupport: false, customDomain: true, whiteLabel: false }
  },
  {
    key: "family_friends",
    name: "Family & Friends",
    monthly_price_cents: 0,
    transaction_fee_bps: 290,
    transaction_fee_fixed_cents: 30,
    active: true,
    feature_flags_json: { prioritySupport: false, customDomain: true, whiteLabel: false, internalOnly: true }
  }
];

function parseFlag(flags: Record<string, unknown> | null, key: string) {
  return Boolean(flags && typeof flags[key] === "boolean" ? flags[key] : false);
}

function normalizePlan(row: BillingPlanRow): PricingPlan {
  return {
    key: row.key,
    name: row.name,
    monthlyPriceCents: Math.max(0, row.monthly_price_cents ?? 0),
    feeBps: Math.min(10_000, Math.max(0, row.transaction_fee_bps ?? 0)),
    feeFixedCents: Math.max(0, row.transaction_fee_fixed_cents ?? 0),
    recommended: row.key === "growth",
    highlights: planHighlights[row.key] ?? ["Core storefront and operations tooling"],
    featureFlags: {
      prioritySupport: parseFlag(row.feature_flags_json, "prioritySupport"),
      customDomain: parseFlag(row.feature_flags_json, "customDomain"),
      whiteLabel: parseFlag(row.feature_flags_json, "whiteLabel"),
      internalOnly: parseFlag(row.feature_flags_json, "internalOnly")
    }
  };
}

export function resolvePricingPlans(rows: BillingPlanRow[] | null | undefined) {
  const source = rows && rows.length > 0 ? rows : fallbackPlans;
  return source
    .filter((plan) => plan.active)
    .filter((plan) => !parseFlag(plan.feature_flags_json, "internalOnly"))
    .sort((a, b) => a.monthly_price_cents - b.monthly_price_cents)
    .map(normalizePlan);
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Math.max(0, cents) / 100);
}

export function formatMoneyWithCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.max(0, cents) / 100);
}

export function formatPlatformFeePercent(bps: number) {
  return `${(Math.max(0, bps) / 100).toFixed(2)}%`;
}
