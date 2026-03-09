import type { PromotionRecord } from "@/types/database";

export function calculateDiscountCents(subtotalCents: number, promotion: Pick<PromotionRecord, "discount_type" | "discount_value">): number {
  if (promotion.discount_type === "fixed") {
    return Math.min(subtotalCents, promotion.discount_value);
  }

  const percent = Math.min(100, Math.max(1, promotion.discount_value));
  return Math.round((subtotalCents * percent) / 100);
}
