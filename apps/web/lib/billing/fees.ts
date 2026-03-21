import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FeeProfile = {
  planKey: string | null;
  feeBps: number;
  feeFixedCents: number;
};

function normalizeFeeProfile(profile: FeeProfile): FeeProfile {
  return {
    planKey: profile.planKey,
    feeBps: Number.isFinite(profile.feeBps) ? Math.min(10000, Math.max(0, Math.round(profile.feeBps))) : 0,
    feeFixedCents: Number.isFinite(profile.feeFixedCents) ? Math.max(0, Math.round(profile.feeFixedCents)) : 0
  };
}

export function calculatePlatformFeeCents(subtotalCents: number, feeProfile: FeeProfile) {
  const normalizedProfile = normalizeFeeProfile(feeProfile);
  const variable = Math.round((Math.max(0, subtotalCents) * normalizedProfile.feeBps) / 10000);
  return Math.max(0, variable + normalizedProfile.feeFixedCents);
}

async function resolveDefaultFeeProfile() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("billing_plans")
    .select("key,transaction_fee_bps,transaction_fee_fixed_cents")
    .eq("key", "standard")
    .eq("active", true)
    .maybeSingle<{
      key: string;
      transaction_fee_bps: number;
      transaction_fee_fixed_cents: number;
    }>();

  if (error || !data) {
    return { planKey: null, feeBps: 0, feeFixedCents: 0 } as FeeProfile;
  }

  return normalizeFeeProfile({
    planKey: data.key,
    feeBps: data.transaction_fee_bps,
    feeFixedCents: data.transaction_fee_fixed_cents
  });
}

export async function resolveStoreFeeProfile(storeId: string): Promise<FeeProfile> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("store_billing_profiles")
    .select("billing_plans(key,transaction_fee_bps,transaction_fee_fixed_cents)")
    .eq("store_id", storeId)
    .maybeSingle<{
      billing_plans:
        | {
            key: string;
            transaction_fee_bps: number;
            transaction_fee_fixed_cents: number;
          }
        | Array<{
            key: string;
            transaction_fee_bps: number;
            transaction_fee_fixed_cents: number;
          }>
        | null;
    }>();

  if (error || !data) {
    return resolveDefaultFeeProfile();
  }

  const plan = Array.isArray(data.billing_plans) ? data.billing_plans[0] : data.billing_plans;
  return normalizeFeeProfile({
    planKey: plan?.key ?? null,
    feeBps: plan?.transaction_fee_bps ?? 0,
    feeFixedCents: plan?.transaction_fee_fixed_cents ?? 0
  });
}

export async function writeOrderFeeBreakdown(params: {
  orderId: string;
  storeId: string;
  feeBaseCents: number;
  feeProfile: FeeProfile;
  platformFeeCents: number;
  netPayoutCents: number;
}) {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("order_fee_breakdowns").upsert(
    {
      order_id: params.orderId,
      store_id: params.storeId,
      plan_key: params.feeProfile.planKey,
      fee_bps: params.feeProfile.feeBps,
      fee_fixed_cents: params.feeProfile.feeFixedCents,
      subtotal_cents: params.feeBaseCents,
      platform_fee_cents: params.platformFeeCents,
      net_payout_cents: params.netPayoutCents
    },
    { onConflict: "order_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
