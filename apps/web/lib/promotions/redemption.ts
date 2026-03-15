export const PROMOTION_CUSTOMER_CAP_REACHED_ERROR =
  "Promo code has already been used the maximum number of times for this customer.";

export function normalizePromotionRedemptionEmail(email: string) {
  return email.trim().toLowerCase();
}
