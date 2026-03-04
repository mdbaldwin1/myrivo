import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "Missing user email" }, { status: 400 });
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const stripe = getStripeClient();
  let accountId = bundle.store.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email,
      metadata: {
        store_id: bundle.store.id,
        owner_user_id: user.id
      }
    });

    accountId = account.id;

    const { error: updateError } = await supabase
      .from("stores")
      .update({ stripe_account_id: accountId })
      .eq("id", bundle.store.id)
      .eq("owner_user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const appUrl = getAppUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/account?payments=refresh`,
    return_url: `${appUrl}/dashboard/account?payments=return`,
    type: "account_onboarding"
  });

  return NextResponse.json({ accountId, onboardingUrl: accountLink.url });
}
