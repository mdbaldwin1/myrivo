import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { readJsonBody } from "@/lib/http/read-json-body";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  billingPlanKey: z.string().trim().min(2).max(40).optional()
});

export async function GET(request: NextRequest) {
  const storeSlug = request.nextUrl.searchParams.get("storeSlug");
  const auth = await requireStorePermission("store.manage_billing", storeSlug);
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [{ data: store, error: storeError }, { data: billing, error: billingError }, { data: plans, error: plansError }] = await Promise.all([
    supabase.from("stores").select("id").eq("id", auth.context.storeId).single(),
    admin
      .from("store_billing_profiles")
      .select("store_id,billing_plan_id,metadata_json,billing_plans(key,name,transaction_fee_bps,transaction_fee_fixed_cents)")
      .eq("store_id", auth.context.storeId)
      .maybeSingle(),
    admin
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
  const assignedPlanRaw =
    billing && typeof billing === "object" && !Array.isArray(billing)
      ? ((billing as { billing_plans?: unknown }).billing_plans ?? null)
      : null;
  const assignedPlan =
    Array.isArray(assignedPlanRaw) && assignedPlanRaw.length > 0
      ? assignedPlanRaw[0]
      : !Array.isArray(assignedPlanRaw)
        ? assignedPlanRaw
        : null;
  const assignedPlanKey =
    assignedPlan && typeof assignedPlan === "object" && !Array.isArray(assignedPlan)
      ? ((assignedPlan as { key?: unknown }).key as string | undefined)
      : undefined;

  let visiblePlans = auth.context.globalRole === "admin" ? allPlans : allPlans.filter((plan) => plan.key !== "family_friends");
  if (assignedPlan && assignedPlanKey && !visiblePlans.some((plan) => plan.key === assignedPlanKey)) {
    visiblePlans = [
      ...visiblePlans,
      {
        id: "",
        key: assignedPlanKey,
        name:
          (assignedPlan as { name?: string }).name ??
          assignedPlanKey.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        monthly_price_cents: 0,
        transaction_fee_bps: (assignedPlan as { transaction_fee_bps?: number }).transaction_fee_bps ?? 0,
        transaction_fee_fixed_cents: (assignedPlan as { transaction_fee_fixed_cents?: number }).transaction_fee_fixed_cents ?? 0,
        active: true
      }
    ];
  }

  return NextResponse.json({
    store,
    billing,
    plans: visiblePlans,
    canManageBillingPlan: auth.context.storeRole === "owner" || auth.context.storeRole === "admin" || auth.context.globalRole === "admin"
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_billing", request.nextUrl.searchParams.get("storeSlug"));
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

  let billingPlanId: string | null | undefined;
  if (payload.data.billingPlanKey) {
    const canManageBillingPlan =
      auth.context.storeRole === "owner" || auth.context.storeRole === "admin" || auth.context.globalRole === "admin";

    if (!canManageBillingPlan) {
      return NextResponse.json({ error: "Only store admins can assign billing plans." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const { data: plan, error: planError } = await admin
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
    const admin = createSupabaseAdminClient();
    const { error: billingError } = await admin.from("store_billing_profiles").upsert(
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

  return GET(request);
}
