import type { StoreDashboardHealthCheck } from "@/lib/dashboard/store-dashboard/store-dashboard-types";

type BuildHealthScoreInput = {
  storeSlug: string;
  hasStripeAccount: boolean;
  hasVerifiedPrimaryDomain: boolean;
  activeProductCount: number;
  hasCheckoutConfigured: boolean;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
  hasSupportEmail: boolean;
};

type BuildHealthScoreResult = {
  score: number;
  checks: StoreDashboardHealthCheck[];
};

export function buildHealthScore(input: BuildHealthScoreInput): BuildHealthScoreResult {
  const checks: StoreDashboardHealthCheck[] = [
    {
      id: "payments",
      label: "Payments ready",
      status: input.hasStripeAccount ? "ready" : "action_needed",
      href: `/dashboard/stores/${input.storeSlug}/store-settings/integrations`,
      weight: 30
    },
    {
      id: "domain",
      label: "Primary domain verified",
      status: input.hasVerifiedPrimaryDomain ? "ready" : "action_needed",
      href: `/dashboard/stores/${input.storeSlug}/store-settings/domains`,
      weight: 20
    },
    {
      id: "active-products",
      label: "Active product published",
      status: input.activeProductCount > 0 ? "ready" : "action_needed",
      href: `/dashboard/stores/${input.storeSlug}/catalog`,
      weight: 15
    },
    {
      id: "checkout",
      label: "Checkout method configured",
      status: input.hasCheckoutConfigured ? "ready" : "action_needed",
      href: `/dashboard/stores/${input.storeSlug}/store-settings/checkout-experience`,
      weight: 15
    },
    {
      id: "seo",
      label: "Store SEO basics configured",
      status: input.hasSeoTitle && input.hasSeoDescription ? "ready" : "action_needed",
      href: `/dashboard/stores/${input.storeSlug}/store-settings/general`,
      weight: 10
    },
    {
      id: "support-email",
      label: "Support email configured",
      status: input.hasSupportEmail ? "ready" : "action_needed",
      href: `/dashboard/stores/${input.storeSlug}/store-settings/general`,
      weight: 10
    }
  ];

  const score = checks.reduce((sum, check) => sum + (check.status === "ready" ? check.weight : 0), 0);

  return { score, checks };
}
