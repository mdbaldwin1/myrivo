import { describe, expect, test } from "vitest";
import { buildStubCheckoutRpcPayload } from "@/lib/storefront/stub-checkout";

describe("buildStubCheckoutRpcPayload", () => {
  test("always includes the explicit discount argument for the six-argument rpc signature", () => {
    expect(
      buildStubCheckoutRpcPayload({
        storeSlug: "at-home-apothecary",
        customerEmail: "buyer@example.com",
        customerUserId: "user-1",
        items: [{ productId: "product-1", quantity: 2 }],
        stubPaymentRef: "stub_pi_123",
        promoCode: "WELCOME10"
      })
    ).toEqual({
      p_store_slug: "at-home-apothecary",
      p_customer_email: "buyer@example.com",
      p_customer_user_id: "user-1",
      p_items: [{ productId: "product-1", quantity: 2 }],
      p_stub_payment_ref: "stub_pi_123",
      p_discount_cents: 0,
      p_promo_code: "WELCOME10"
    });
  });

  test("clamps negative discounts to zero", () => {
    expect(
      buildStubCheckoutRpcPayload({
        storeSlug: "at-home-apothecary",
        customerEmail: "buyer@example.com",
        items: [],
        stubPaymentRef: null,
        discountCents: -50,
        promoCode: null
      }).p_discount_cents
    ).toBe(0);
  });
});
