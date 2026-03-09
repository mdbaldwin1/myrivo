import { NextResponse } from "next/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
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

  if (!bundle.store.stripe_account_id) {
    return NextResponse.json({
      connected: false,
      readyForLiveCheckout: false
    });
  }

  try {
    const account = await getStripeClient().accounts.retrieve(bundle.store.stripe_account_id);
    const readyForLiveCheckout = Boolean(account.charges_enabled && account.payouts_enabled);

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      readyForLiveCheckout
    });
  } catch {
    return NextResponse.json({
      connected: true,
      accountId: bundle.store.stripe_account_id,
      readyForLiveCheckout: false
    });
  }
}
