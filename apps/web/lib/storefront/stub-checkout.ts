export type StubCheckoutRpcInput = {
  storeSlug: string;
  customerEmail: string;
  customerUserId?: string | null;
  items: unknown;
  stubPaymentRef: string | null;
  discountCents?: number | null;
  promoCode?: string | null;
};

export function buildStubCheckoutRpcPayload(input: StubCheckoutRpcInput) {
  return {
    p_store_slug: input.storeSlug,
    p_customer_email: input.customerEmail,
    p_customer_user_id: input.customerUserId ?? null,
    p_items: input.items,
    p_stub_payment_ref: input.stubPaymentRef,
    p_discount_cents: Math.max(0, input.discountCents ?? 0),
    p_promo_code: input.promoCode ?? null
  };
}
