import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";

export type StoreStripePaymentsReadiness = {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  taxSettingsStatus?: "active" | "pending" | "unavailable";
  taxMissingFields?: string[];
  taxReady?: boolean;
  readyForLiveCheckout: boolean;
};

export async function getStoreStripePaymentsReadiness(accountId: string | null): Promise<StoreStripePaymentsReadiness> {
  if (!accountId) {
    return {
      connected: false,
      readyForLiveCheckout: false
    };
  }

  const stripe = getStripeClient();

  let account: Stripe.Account;

  try {
    account = await stripe.accounts.retrieve(accountId);
  } catch {
    return {
      connected: true,
      accountId,
      taxSettingsStatus: "unavailable",
      taxMissingFields: [],
      taxReady: false,
      readyForLiveCheckout: false
    };
  }

  let taxSettingsStatus: "active" | "pending" | "unavailable" = "unavailable";
  let taxMissingFields: string[] = [];

  try {
    const taxSettings = await stripe.tax.settings.retrieve({}, { stripeAccount: accountId });
    taxSettingsStatus = taxSettings.status;
    taxMissingFields = taxSettings.status_details.pending?.missing_fields ?? [];
  } catch {
    taxSettingsStatus = "unavailable";
    taxMissingFields = [];
  }

  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const taxReady = taxSettingsStatus === "active";

  return {
    connected: true,
    accountId: account.id,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    taxSettingsStatus,
    taxMissingFields,
    taxReady,
    readyForLiveCheckout: chargesEnabled && payoutsEnabled && taxReady
  };
}
