import { describe, expect, test } from "vitest";
import { calculateDiscountCents } from "@/lib/promotions/calculate-discount";

describe("calculateDiscountCents", () => {
  test("applies fixed discount and caps at subtotal", () => {
    expect(calculateDiscountCents(1000, { discount_type: "fixed", discount_value: 200 })).toBe(200);
    expect(calculateDiscountCents(1000, { discount_type: "fixed", discount_value: 2000 })).toBe(1000);
  });

  test("applies percent discount", () => {
    expect(calculateDiscountCents(1000, { discount_type: "percent", discount_value: 10 })).toBe(100);
    expect(calculateDiscountCents(999, { discount_type: "percent", discount_value: 15 })).toBe(150);
  });
});
