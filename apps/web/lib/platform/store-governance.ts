export const STORE_GOVERNANCE_REASON_CODES = [
  "policy_violation",
  "prohibited_products",
  "incomplete_setup",
  "identity_unverified",
  "fraud_risk",
  "other"
] as const;

export type StoreGovernanceReasonCode = (typeof STORE_GOVERNANCE_REASON_CODES)[number];

export const STORE_GOVERNANCE_REASON_LABELS: Record<StoreGovernanceReasonCode, string> = {
  policy_violation: "Policy violation",
  prohibited_products: "Prohibited products",
  incomplete_setup: "Incomplete setup",
  identity_unverified: "Identity unverified",
  fraud_risk: "Fraud risk",
  other: "Other"
};
