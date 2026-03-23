export type StoreTaxCollectionMode = "unconfigured" | "stripe_tax" | "seller_attested_no_tax";

export function isStoreTaxDecisionConfigured(mode: StoreTaxCollectionMode | null | undefined) {
  return Boolean(mode && mode !== "unconfigured");
}

type StripeOperationalReadiness = {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  readyForLiveCheckout: boolean;
};

export function isStoreStripeOperationallyReady(readiness: StripeOperationalReadiness) {
  return Boolean(readiness.connected && readiness.chargesEnabled && readiness.payoutsEnabled && readiness.detailsSubmitted);
}

export function isStorePaymentsReadyForLaunch(
  mode: StoreTaxCollectionMode | null | undefined,
  readiness: StripeOperationalReadiness
) {
  if (!mode || mode === "unconfigured") {
    return false;
  }

  if (mode === "stripe_tax") {
    return readiness.readyForLiveCheckout;
  }

  return isStoreStripeOperationallyReady(readiness);
}
