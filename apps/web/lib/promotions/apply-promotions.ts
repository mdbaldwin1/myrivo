import type { PromotionDiscountType } from "@/types/database";
import { calculatePromotionApplicationCents } from "@/lib/promotions/calculate-discount";
import { PROMOTION_CUSTOMER_CAP_REACHED_ERROR } from "@/lib/promotions/redemption";

export type PromotionApplicationRecord = {
  id: string;
  code: string;
  discount_type: PromotionDiscountType;
  discount_value: number;
  min_subtotal_cents: number;
  max_redemptions: number | null;
  per_customer_redemption_limit: number | null;
  times_redeemed: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  is_stackable?: boolean | null;
};

export type AppliedPromotionSummary = {
  promotionId: string;
  code: string;
  discountType: PromotionDiscountType;
  itemDiscountCents: number;
  shippingDiscountCents: number;
};

export function normalizeRequestedPromoCodes(input: { promoCode?: string | null; promoCodes?: string[] | null }) {
  const raw = [...(input.promoCodes ?? []), input.promoCode ?? ""];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of raw) {
    const code = value.trim().toUpperCase();
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    normalized.push(code);
  }

  return normalized;
}

export function applyPromotionSequence(input: {
  requestedCodes: string[];
  promotionsByCode: Map<string, PromotionApplicationRecord>;
  subtotalCents: number;
  shippingFeeCents: number;
  maxPromoCodes: number;
  allowShippingPromotions: boolean;
  getCustomerRedemptionCount?: (promotion: PromotionApplicationRecord) => Promise<number>;
  now?: number;
}) {
  return (async () => {
    const requestedCodes = input.requestedCodes;
    const maxPromoCodes = Math.max(1, input.maxPromoCodes);

    if (requestedCodes.length > maxPromoCodes) {
      throw new Error(`Only ${maxPromoCodes} promo code${maxPromoCodes === 1 ? "" : "s"} can be applied to one order.`);
    }

    let runningSubtotalCents = Math.max(0, input.subtotalCents);
    let runningShippingFeeCents = Math.max(0, input.shippingFeeCents);
    let hasAppliedExclusiveCode = false;
    let shippingPromotionCount = 0;
    const now = input.now ?? Date.now();
    const appliedPromotions: AppliedPromotionSummary[] = [];

    for (const code of requestedCodes) {
      const promotion = input.promotionsByCode.get(code);

      if (!promotion || !promotion.is_active) {
        throw new Error("Promo code is invalid or inactive.");
      }

      if (promotion.starts_at && new Date(promotion.starts_at).getTime() > now) {
        throw new Error("Promo code is not active yet.");
      }

      if (promotion.ends_at && new Date(promotion.ends_at).getTime() < now) {
        throw new Error("Promo code has expired.");
      }

      if (promotion.max_redemptions !== null && promotion.times_redeemed >= promotion.max_redemptions) {
        throw new Error("Promo code redemption limit reached.");
      }

      if (input.subtotalCents < promotion.min_subtotal_cents) {
        throw new Error(`Promo requires minimum subtotal of $${(promotion.min_subtotal_cents / 100).toFixed(2)}.`);
      }

      if (hasAppliedExclusiveCode || (appliedPromotions.length > 0 && !promotion.is_stackable)) {
        throw new Error(`Promo code ${promotion.code} cannot be combined with other promo codes.`);
      }

      if (!promotion.is_stackable) {
        hasAppliedExclusiveCode = true;
      }

      if (promotion.discount_type === "free_shipping") {
        shippingPromotionCount += 1;

        if (!input.allowShippingPromotions) {
          throw new Error("Free shipping promo codes can only be used on shipping orders.");
        }

        if (shippingPromotionCount > 1) {
          throw new Error("Only one free shipping promo code can be applied to an order.");
        }
      }

      if (input.getCustomerRedemptionCount && promotion.per_customer_redemption_limit !== null) {
        const redemptionCount = await input.getCustomerRedemptionCount(promotion);
        if (redemptionCount >= promotion.per_customer_redemption_limit) {
          throw new Error(PROMOTION_CUSTOMER_CAP_REACHED_ERROR);
        }
      }

      const applied = calculatePromotionApplicationCents(runningSubtotalCents, runningShippingFeeCents, promotion);
      runningSubtotalCents = applied.discountedSubtotalCents;
      runningShippingFeeCents = applied.effectiveShippingFeeCents;
      appliedPromotions.push({
        promotionId: promotion.id,
        code: promotion.code,
        discountType: promotion.discount_type,
        itemDiscountCents: applied.itemDiscountCents,
        shippingDiscountCents: applied.shippingDiscountCents
      });
    }

    return {
      appliedPromotions,
      itemDiscountCents: Math.max(0, input.subtotalCents - runningSubtotalCents),
      shippingDiscountCents: Math.max(0, input.shippingFeeCents - runningShippingFeeCents),
      effectiveShippingFeeCents: runningShippingFeeCents,
      discountedSubtotalCents: runningSubtotalCents,
      discountedTotalCents: runningSubtotalCents + runningShippingFeeCents
    };
  })();
}
