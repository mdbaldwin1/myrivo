import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { readJsonBody } from "@/lib/http/read-json-body";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  billingPlanKey: z.string().trim().min(2).max(40).optional()
});

export async function GET() {
  const auth = await requireStorePermission("store.manage_billing");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: store, error: storeError }, { data: billing, error: billingError }, { data: plans, error: plansError }] = await Promise.all([
    supabase.from("stores").select("id").eq("id", auth.context.storeId).single(),
    supabase
      .from("store_billing_profiles")
      .select("store_id,billing_plan_id,test_mode_enabled,metadata_json,billing_plans(key,name,transaction_fee_bps,transaction_fee_fixed_cents)")
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

  const allPlans = plans ?? [];
  const visiblePlans = auth.context.globalRole === "admin" ? allPlans : allPlans.filter((plan) => plan.key !== "family_friends");

  return NextResponse.json({ store, billing, plans: visiblePlans, canManageBillingPlan: auth.context.globalRole === "admin" });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_billing");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return rawBody.response;
  }

  const payload = updateSchema.safeParse(rawBody.data);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  let billingPlanId: string | null | undefined;
  if (payload.data.billingPlanKey) {
    if (auth.context.globalRole !== "admin") {
      return NextResponse.json({ error: "Only platform admins can assign billing plans." }, { status: 403 });
    }

    const { data: plan, error: planError } = await supabase
      .from("billing_plans")
      .select("id,key")
      .eq("key", payload.data.billingPlanKey)
      .eq("active", true)
      .maybeSingle<{ id: string; key: string }>();

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    if (!plan) {
      return NextResponse.json({ error: "Billing plan not found" }, { status: 400 });
    }

    if (plan.key !== "standard" && plan.key !== "family_friends") {
      return NextResponse.json({ error: "Unsupported billing plan." }, { status: 400 });
    }

    if (plan.key === "family_friends" && auth.context.globalRole !== "admin") {
      return NextResponse.json({ error: "Only platform admins can assign the family & friends plan." }, { status: 403 });
    }

    billingPlanId = plan.id;
  }

  if (payload.data.billingPlanKey !== undefined) {
    const { error: billingError } = await supabase.from("store_billing_profiles").upsert(
      {
        store_id: auth.context.storeId,
        billing_plan_id: billingPlanId
      },
      { onConflict: "store_id" }
    );

    if (billingError) {
      return NextResponse.json({ error: billingError.message }, { status: 500 });
    }
  }

  return GET();
}
