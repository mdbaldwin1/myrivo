import { describe, expect, it } from "vitest";
import { formatMoney, formatPlatformFeePercent, resolvePricingPlans, type BillingPlanRow } from "@/lib/marketing/pricing";

describe("pricing config", () => {
  it("returns live active plans in monthly price order", () => {
    const rows: BillingPlanRow[] = [
      {
        key: "family_friends",
        name: "Family & Friends",
        monthly_price_cents: 0,
        transaction_fee_bps: 290,
        transaction_fee_fixed_cents: 30,
        active: true,
        feature_flags_json: { prioritySupport: false, customDomain: true, whiteLabel: false, internalOnly: true }
      },
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

    expect(plans).toHaveLength(1);
    expect(plans.map((plan) => plan.key)).toEqual(["standard"]);
    expect(plans.at(0)?.featureFlags.customDomain).toBe(true);
  });

  it("falls back to default plans when none are provided", () => {
    const plans = resolvePricingPlans(null);
    expect(plans.map((plan) => plan.key)).toEqual(["standard"]);
  });

  it("formats money and fee labels consistently", () => {
    expect(formatMoney(14900)).toBe("$149");
    expect(formatMoney(0)).toBe("$0");
    expect(formatPlatformFeePercent(600)).toBe("6.00%");
  });
});
