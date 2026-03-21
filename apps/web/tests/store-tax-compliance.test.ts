import { describe, expect, test } from "vitest";
import { isStoreTaxDecisionConfigured } from "@/lib/stores/tax-compliance";

describe("store tax compliance helpers", () => {
  test("treats unconfigured as not configured", () => {
    expect(isStoreTaxDecisionConfigured("unconfigured")).toBe(false);
    expect(isStoreTaxDecisionConfigured(null)).toBe(false);
    expect(isStoreTaxDecisionConfigured(undefined)).toBe(false);
  });

  test("treats explicit seller decisions as configured", () => {
    expect(isStoreTaxDecisionConfigured("stripe_tax")).toBe(true);
    expect(isStoreTaxDecisionConfigured("seller_attested_no_tax")).toBe(true);
  });
});
