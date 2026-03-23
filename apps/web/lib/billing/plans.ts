import type { GlobalUserRole } from "@/types/database";

export type BillingPlanSummary = {
  key: string;
  name: string;
  transaction_fee_bps: number;
  transaction_fee_fixed_cents: number;
};

export type BillingPlanOption = BillingPlanSummary & {
  id: string;
  monthly_price_cents: number;
  active: boolean;
};

export const ASSIGNABLE_BILLING_PLAN_KEYS = ["standard", "family_friends"] as const;

export function isAssignableBillingPlanKey(key: string) {
  return ASSIGNABLE_BILLING_PLAN_KEYS.includes(key as (typeof ASSIGNABLE_BILLING_PLAN_KEYS)[number]);
}

export function isInternalBillingPlanKey(key: string) {
  return key === "family_friends";
}

export function canAssignBillingPlanKey(globalRole: GlobalUserRole, key: string) {
  if (!isAssignableBillingPlanKey(key)) {
    return false;
  }

  if (isInternalBillingPlanKey(key) && globalRole !== "admin") {
    return false;
  }

  return true;
}

export function isVisibleStoreWorkspaceBillingPlan(globalRole: GlobalUserRole, key: string) {
  if (!isAssignableBillingPlanKey(key)) {
    return false;
  }

  if (isInternalBillingPlanKey(key) && globalRole !== "admin") {
    return false;
  }

  return true;
}

export function formatBillingPlanLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
