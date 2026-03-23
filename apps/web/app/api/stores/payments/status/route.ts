import { NextResponse } from "next/server";
import { getStoreStripePaymentsReadiness } from "@/lib/stripe/store-payments-readiness";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeSlug = new URL(request.url).searchParams.get("storeSlug");
  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const { data: taxDecision, error: taxDecisionError } = await supabase
    .from("stores")
    .select("tax_collection_mode,tax_compliance_acknowledged_at,tax_compliance_note")
    .eq("id", bundle.store.id)
    .maybeSingle<{
      tax_collection_mode: "unconfigured" | "stripe_tax" | "seller_attested_no_tax";
      tax_compliance_acknowledged_at: string | null;
      tax_compliance_note: string | null;
    }>();

  if (taxDecisionError && !isMissingColumnInSchemaCache(taxDecisionError, "tax_collection_mode")) {
    return NextResponse.json({ error: taxDecisionError.message }, { status: 500 });
  }

  const resolvedTaxDecision = isMissingColumnInSchemaCache(taxDecisionError, "tax_collection_mode")
    ? {
        tax_collection_mode: "unconfigured" as const,
        tax_compliance_acknowledged_at: null,
        tax_compliance_note: null
      }
    : taxDecision;

  try {
    const readiness = await getStoreStripePaymentsReadiness(bundle.store.stripe_account_id);
    return NextResponse.json({
      ...readiness,
      taxCollectionMode: resolvedTaxDecision?.tax_collection_mode ?? "unconfigured",
      taxComplianceAcknowledgedAt: resolvedTaxDecision?.tax_compliance_acknowledged_at ?? null,
      taxComplianceNote: resolvedTaxDecision?.tax_compliance_note ?? null
    });
  } catch {
    return NextResponse.json({
      connected: true,
      accountId: bundle.store.stripe_account_id,
      taxSettingsStatus: "unavailable",
      taxMissingFields: [],
      taxReady: false,
      readyForLiveCheckout: false,
      taxCollectionMode: resolvedTaxDecision?.tax_collection_mode ?? "unconfigured",
      taxComplianceAcknowledgedAt: resolvedTaxDecision?.tax_compliance_acknowledged_at ?? null,
      taxComplianceNote: resolvedTaxDecision?.tax_compliance_note ?? null
    });
  }
}
