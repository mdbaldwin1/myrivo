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
  };
};

const planHighlights: Record<string, string[]> = {
  starter: [
    "Hosted storefront + checkout",
    "Catalog, inventory, and order management",
    "Email workflows and subscriber capture"
  ],
  growth: [
    "Lower transaction fee for scaling volume",
    "Custom domain storefront support",
    "Priority support + advanced operations controls"
  ],
  scale: [
    "Lowest platform fee profile",
    "White-label + multi-store operational scale",
    "Highest-priority support path"
  ]
};

const fallbackPlans: BillingPlanRow[] = [
  {
    key: "starter",
    name: "Starter",
    monthly_price_cents: 0,
    transaction_fee_bps: 350,
    transaction_fee_fixed_cents: 0,
    active: true,
    feature_flags_json: { prioritySupport: false, customDomain: false, whiteLabel: false }
  },
  {
    key: "growth",
    name: "Growth",
    monthly_price_cents: 4900,
    transaction_fee_bps: 200,
    transaction_fee_fixed_cents: 0,
    active: true,
    feature_flags_json: { prioritySupport: true, customDomain: true, whiteLabel: false }
  },
  {
    key: "scale",
    name: "Scale",
    monthly_price_cents: 14900,
    transaction_fee_bps: 100,
    transaction_fee_fixed_cents: 0,
    active: true,
    feature_flags_json: { prioritySupport: true, customDomain: true, whiteLabel: true }
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
      whiteLabel: parseFlag(row.feature_flags_json, "whiteLabel")
    }
  };
}

export function resolvePricingPlans(rows: BillingPlanRow[] | null | undefined) {
  const source = rows && rows.length > 0 ? rows : fallbackPlans;
  return source
    .filter((plan) => plan.active)
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

export function formatPlatformFeePercent(bps: number) {
  return `${(Math.max(0, bps) / 100).toFixed(2)}%`;
}
