import { describe, expect, it } from "vitest";
import {
  canResumeCheckoutWhenDigitalProductsDisabled,
  filterProductsForDigitalProductsRollout,
} from "@/lib/digital-products/rollout-policy";

describe("digital product rollout policy", () => {
  it("removes digital products when disabled without affecting physical catalog", () => {
    const products = [
      { id: "physical", product_type: "physical" as const },
      { id: "digital", product_type: "digital" as const },
    ];

    expect(filterProductsForDigitalProductsRollout(products, false)).toEqual([products[0]]);
    expect(filterProductsForDigitalProductsRollout(products, true)).toEqual(products);
  });

  it("only resumes disabled digital checkout after completion", () => {
    expect(canResumeCheckoutWhenDigitalProductsDisabled("physical_only", "pending")).toBe(true);
    expect(canResumeCheckoutWhenDigitalProductsDisabled("digital_only", "pending")).toBe(false);
    expect(canResumeCheckoutWhenDigitalProductsDisabled("mixed", "pending")).toBe(false);
    expect(canResumeCheckoutWhenDigitalProductsDisabled("digital_only", "completed")).toBe(true);
    expect(canResumeCheckoutWhenDigitalProductsDisabled("mixed", "completed")).toBe(true);
  });
});
