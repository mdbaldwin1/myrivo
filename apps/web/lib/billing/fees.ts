import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FeeProfile = {
  planKey: string | null;
  feeBps: number;
  feeFixedCents: number;
};

export function calculatePlatformFeeCents(subtotalCents: number, feeProfile: FeeProfile) {
  const variable = Math.round((Math.max(0, subtotalCents) * Math.max(0, feeProfile.feeBps)) / 10000);
  return Math.max(0, variable + Math.max(0, feeProfile.feeFixedCents));
}

export async function resolveStoreFeeProfile(storeId: string): Promise<FeeProfile> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("store_billing_profiles")
    .select("fee_override_bps,fee_override_fixed_cents,billing_plans(key,transaction_fee_bps,transaction_fee_fixed_cents)")
    .eq("store_id", storeId)
    .maybeSingle<{
      fee_override_bps: number | null;
      fee_override_fixed_cents: number | null;
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
    return { planKey: null, feeBps: 0, feeFixedCents: 0 };
  }

  const plan = Array.isArray(data.billing_plans) ? data.billing_plans[0] : data.billing_plans;
  return {
    planKey: plan?.key ?? null,
    feeBps: data.fee_override_bps ?? plan?.transaction_fee_bps ?? 0,
    feeFixedCents: data.fee_override_fixed_cents ?? plan?.transaction_fee_fixed_cents ?? 0
  };
}

export async function writeOrderFeeBreakdown(params: {
  orderId: string;
  storeId: string;
  subtotalCents: number;
  feeProfile: FeeProfile;
  platformFeeCents: number;
  netPayoutCents: number;
}) {
  const admin = createSupabaseAdminClient();

  await admin.from("order_fee_breakdowns").upsert(
    {
      order_id: params.orderId,
      store_id: params.storeId,
      plan_key: params.feeProfile.planKey,
      fee_bps: params.feeProfile.feeBps,
      fee_fixed_cents: params.feeProfile.feeFixedCents,
      subtotal_cents: params.subtotalCents,
      platform_fee_cents: params.platformFeeCents,
      net_payout_cents: params.netPayoutCents
    },
    { onConflict: "order_id" }
  );
}
