import type { PromotionRecord } from "@/types/database";

export function calculatePromotionApplicationCents(
  subtotalCents: number,
  shippingFeeCents: number,
  promotion: Pick<PromotionRecord, "discount_type" | "discount_value">
) {
  const safeSubtotalCents = Math.max(0, subtotalCents);
  const safeShippingFeeCents = Math.max(0, shippingFeeCents);

  if (promotion.discount_type === "free_shipping") {
    return {
      itemDiscountCents: 0,
      shippingDiscountCents: safeShippingFeeCents,
      discountCents: safeShippingFeeCents,
      discountedSubtotalCents: safeSubtotalCents,
      effectiveShippingFeeCents: 0,
      discountedTotalCents: safeSubtotalCents
    };
  }

  const itemDiscountCents =
    promotion.discount_type === "fixed"
      ? Math.min(safeSubtotalCents, promotion.discount_value)
      : Math.round((safeSubtotalCents * Math.min(100, Math.max(1, promotion.discount_value))) / 100);

  return {
    itemDiscountCents,
    shippingDiscountCents: 0,
    discountCents: itemDiscountCents,
    discountedSubtotalCents: Math.max(0, safeSubtotalCents - itemDiscountCents),
    effectiveShippingFeeCents: safeShippingFeeCents,
    discountedTotalCents: Math.max(0, safeSubtotalCents - itemDiscountCents) + safeShippingFeeCents
  };
}

export function calculateDiscountCents(subtotalCents: number, promotion: Pick<PromotionRecord, "discount_type" | "discount_value">): number {
  return calculatePromotionApplicationCents(subtotalCents, 0, promotion).discountCents;
}
