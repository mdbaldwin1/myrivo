import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { canAssignBillingPlanKey, formatBillingPlanLabel, type BillingPlanSummary } from "@/lib/billing/plans";
import { readJsonBody } from "@/lib/http/read-json-body";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  billingPlanKey: z.string().trim().min(2).max(40)
});

type StoreRow = {
  id: string;
  slug: string;
  name: string;
};

type StoreBillingProfileRow = {
  billing_plans: BillingPlanSummary | BillingPlanSummary[] | null;
};

function normalizeBillingPlan(raw: StoreBillingProfileRow["billing_plans"]): BillingPlanSummary | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }

  return {
    key: value.key,
    name: value.name ?? formatBillingPlanLabel(value.key),
    transaction_fee_bps: value.transaction_fee_bps,
    transaction_fee_fixed_cents: value.transaction_fee_fixed_cents
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return rawBody.response;
  }

  const payload = payloadSchema.safeParse(rawBody.data);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { storeId } = await params;
  const admin = createSupabaseAdminClient();

  const [{ data: store, error: storeError }, { data: existingBillingProfile, error: existingBillingError }, { data: plan, error: planError }] =
    await Promise.all([
      admin.from("stores").select("id,slug,name").eq("id", storeId).maybeSingle<StoreRow>(),
      admin
        .from("store_billing_profiles")
        .select("billing_plans(key,name,transaction_fee_bps,transaction_fee_fixed_cents)")
        .eq("store_id", storeId)
        .maybeSingle<StoreBillingProfileRow>(),
      admin
        .from("billing_plans")
        .select("id,key,name,transaction_fee_bps,transaction_fee_fixed_cents")
        .eq("key", payload.data.billingPlanKey)
        .eq("active", true)
        .maybeSingle<{
          id: string;
          key: string;
          name: string;
          transaction_fee_bps: number;
          transaction_fee_fixed_cents: number;
        }>()
    ]);

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  if (existingBillingError) {
    return NextResponse.json({ error: existingBillingError.message }, { status: 500 });
  }

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 });
  }

  if (!plan) {
    return NextResponse.json({ error: "Billing plan not found." }, { status: 400 });
  }

  if (!canAssignBillingPlanKey(auth.context?.globalRole ?? "user", plan.key)) {
    return NextResponse.json({ error: "Unsupported billing plan." }, { status: 400 });
  }

  const { error: billingError } = await admin.from("store_billing_profiles").upsert(
    {
      store_id: store.id,
      billing_plan_id: plan.id
    },
    { onConflict: "store_id" }
  );

  if (billingError) {
    return NextResponse.json({ error: billingError.message }, { status: 500 });
  }

  const previousPlan = normalizeBillingPlan(existingBillingProfile?.billing_plans ?? null);
  await logAuditEvent({
    storeId: store.id,
    actorUserId: auth.context?.userId ?? null,
    action: "update",
    entity: "store",
    entityId: store.id,
    metadata: {
      fromBillingPlanKey: previousPlan?.key ?? null,
      toBillingPlanKey: plan.key,
      source: "platform_store_billing_plan"
    }
  });

  return NextResponse.json({
    ok: true,
    billingPlan: {
      key: plan.key,
      name: plan.name ?? formatBillingPlanLabel(plan.key),
      transaction_fee_bps: plan.transaction_fee_bps,
      transaction_fee_fixed_cents: plan.transaction_fee_fixed_cents
    }
  });
}
