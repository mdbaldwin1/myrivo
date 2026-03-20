import { NextResponse } from "next/server";
import { getStoreStripePaymentsReadiness } from "@/lib/stripe/store-payments-readiness";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
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

  try {
    return NextResponse.json(await getStoreStripePaymentsReadiness(bundle.store.stripe_account_id));
  } catch {
    return NextResponse.json({
      connected: true,
      accountId: bundle.store.stripe_account_id,
      taxSettingsStatus: "unavailable",
      taxMissingFields: [],
      taxReady: false,
      readyForLiveCheckout: false
    });
  }
}
