import { describe, expect, it } from "vitest";
import { formatMoney, formatPlatformFeePercent, resolvePricingPlans, type BillingPlanRow } from "@/lib/marketing/pricing";

describe("pricing config", () => {
  it("returns live active plans in monthly price order", () => {
    const rows: BillingPlanRow[] = [
      {
        key: "scale",
        name: "Scale",
        monthly_price_cents: 14900,
        transaction_fee_bps: 100,
        transaction_fee_fixed_cents: 0,
        active: true,
        feature_flags_json: { prioritySupport: true, customDomain: true, whiteLabel: true }
      },
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
        key: "legacy",
        name: "Legacy",
        monthly_price_cents: 9900,
        transaction_fee_bps: 200,
        transaction_fee_fixed_cents: 0,
        active: false,
        feature_flags_json: null
      }
    ];

    const plans = resolvePricingPlans(rows);

    expect(plans).toHaveLength(2);
    expect(plans.map((plan) => plan.key)).toEqual(["starter", "scale"]);
    expect(plans.at(1)?.featureFlags.whiteLabel).toBe(true);
  });

  it("falls back to default plans when none are provided", () => {
    const plans = resolvePricingPlans(null);
    expect(plans.map((plan) => plan.key)).toEqual(["starter", "growth", "scale"]);
  });

  it("formats money and fee labels consistently", () => {
    expect(formatMoney(14900)).toBe("$149");
    expect(formatMoney(0)).toBe("$0");
    expect(formatPlatformFeePercent(350)).toBe("3.50%");
  });
});
