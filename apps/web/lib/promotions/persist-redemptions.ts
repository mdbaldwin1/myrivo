import type { AppliedPromotionSummary } from "@/lib/promotions/apply-promotions";
import { normalizePromotionRedemptionEmail } from "@/lib/promotions/redemption";

type PersistPromotionRedemptionsInput = {
  supabase: PromotionRedemptionPersistenceClient;
  appliedPromotions: AppliedPromotionSummary[];
  storeId: string;
  orderId: string;
  customerEmail: string;
  customerUserId: string | null;
};

export type PromotionRedemptionPersistenceClient = {
  from: (table: string) => {
    upsert: (
      values: Array<Record<string, unknown>>,
      options?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) => PromiseLike<{ error: { message: string } | null }>;
    select: (
      columns: string,
      options?: { count?: "exact"; head?: boolean }
    ) => {
      eq: (
        column: string,
        value: string
      ) => PromiseLike<{ count?: number | null; error: { message: string } | null }>;
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export async function persistPromotionRedemptions({
  supabase,
  appliedPromotions,
  storeId,
  orderId,
  customerEmail,
  customerUserId
}: PersistPromotionRedemptionsInput) {
  if (appliedPromotions.length === 0) {
    return;
  }

  const normalizedEmail = normalizePromotionRedemptionEmail(customerEmail);

  const { error: upsertError } = await supabase.from("promotion_redemptions").upsert(
    appliedPromotions.map((promotion) => ({
      store_id: storeId,
      promotion_id: promotion.promotionId,
      order_id: orderId,
      customer_user_id: customerUserId,
      customer_email_normalized: normalizedEmail
    })),
    {
      onConflict: "order_id,promotion_id",
      ignoreDuplicates: false
    }
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const uniquePromotionIds = [...new Set(appliedPromotions.map((promotion) => promotion.promotionId))];

  for (const promotionId of uniquePromotionIds) {
    const { count: redemptionCount = 0, error: redemptionError } = await supabase
      .from("promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", promotionId);

    if (redemptionError) {
      throw new Error(redemptionError.message);
    }

    const { error: updateError } = await supabase
      .from("promotions")
      .update({ times_redeemed: redemptionCount })
      .eq("id", promotionId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
}
