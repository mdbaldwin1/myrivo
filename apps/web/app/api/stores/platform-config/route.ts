import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  mode: z.enum(["sandbox", "live"]).optional(),
  whiteLabelEnabled: z.boolean().optional(),
  whiteLabelBrandName: z.string().trim().max(120).nullable().optional(),
  whiteLabelFaviconPath: z.string().trim().max(400).nullable().optional(),
  billingPlanKey: z.string().trim().min(2).max(40).optional(),
  feeOverrideBps: z.number().int().min(0).max(10000).nullable().optional(),
  feeOverrideFixedCents: z.number().int().min(0).nullable().optional(),
  testModeEnabled: z.boolean().optional()
});

export async function GET() {
  const auth = await requireStoreRole("admin");
  if (auth.response || !auth.context) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: store, error: storeError }, { data: billing, error: billingError }, { data: plans, error: plansError }] = await Promise.all([
    supabase
      .from("stores")
      .select("id,mode,white_label_enabled,white_label_brand_name,white_label_favicon_path")
      .eq("id", auth.context.storeId)
      .single(),
    supabase
      .from("store_billing_profiles")
      .select("store_id,billing_plan_id,fee_override_bps,fee_override_fixed_cents,billing_mode,test_mode_enabled,metadata_json,billing_plans(key,name,transaction_fee_bps,transaction_fee_fixed_cents)")
      .eq("store_id", auth.context.storeId)
      .maybeSingle(),
    supabase
      .from("billing_plans")
      .select("id,key,name,monthly_price_cents,transaction_fee_bps,transaction_fee_fixed_cents,active")
      .eq("active", true)
      .order("monthly_price_cents", { ascending: true })
  ]);

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (billingError) {
    return NextResponse.json({ error: billingError.message }, { status: 500 });
  }

  if (plansError) {
    return NextResponse.json({ error: plansError.message }, { status: 500 });
  }

  return NextResponse.json({ store, billing, plans: plans ?? [] });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("admin");
  if (auth.response || !auth.context) {
    return auth.response;
  }

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const storeUpdate: Record<string, unknown> = {};
  if (payload.data.mode !== undefined) {
    storeUpdate.mode = payload.data.mode;
  }
  if (payload.data.whiteLabelEnabled !== undefined) {
    storeUpdate.white_label_enabled = payload.data.whiteLabelEnabled;
  }
  if (payload.data.whiteLabelBrandName !== undefined) {
    storeUpdate.white_label_brand_name = payload.data.whiteLabelBrandName;
  }
  if (payload.data.whiteLabelFaviconPath !== undefined) {
    storeUpdate.white_label_favicon_path = payload.data.whiteLabelFaviconPath;
  }

  if (Object.keys(storeUpdate).length > 0) {
    const { error: storeError } = await supabase.from("stores").update(storeUpdate).eq("id", auth.context.storeId);
    if (storeError) {
      return NextResponse.json({ error: storeError.message }, { status: 500 });
    }
  }

  let billingPlanId: string | null | undefined;
  if (payload.data.billingPlanKey) {
    const { data: plan, error: planError } = await supabase
      .from("billing_plans")
      .select("id")
      .eq("key", payload.data.billingPlanKey)
      .eq("active", true)
      .maybeSingle<{ id: string }>();

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    if (!plan) {
      return NextResponse.json({ error: "Billing plan not found" }, { status: 400 });
    }

    billingPlanId = plan.id;
  }

  if (
    payload.data.billingPlanKey !== undefined ||
    payload.data.feeOverrideBps !== undefined ||
    payload.data.feeOverrideFixedCents !== undefined ||
    payload.data.testModeEnabled !== undefined
  ) {
    const { error: billingError } = await supabase.from("store_billing_profiles").upsert(
      {
        store_id: auth.context.storeId,
        billing_plan_id: billingPlanId,
        fee_override_bps: payload.data.feeOverrideBps ?? null,
        fee_override_fixed_cents: payload.data.feeOverrideFixedCents ?? null,
        test_mode_enabled: payload.data.testModeEnabled ?? false
      },
      { onConflict: "store_id" }
    );

    if (billingError) {
      return NextResponse.json({ error: billingError.message }, { status: 500 });
    }
  }

  return GET();
}
