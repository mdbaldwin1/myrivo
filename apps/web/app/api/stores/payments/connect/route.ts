import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, isStripeStubMode, stripeEnvSchema } from "@/lib/env";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function resolveAppUrlForRequest(request: NextRequest): string {
  try {
    return getAppUrl();
  } catch {
    return request.nextUrl.origin;
  }
}

function isPlaceholderStripeKey(secretKey: string | undefined): boolean {
  if (!secretKey) {
    return true;
  }
  return secretKey.includes("placeholder") || secretKey.includes("local_placeholder");
}

export async function POST(request: NextRequest) {
  try {
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

    const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "admin");

    if (!bundle) {
      return NextResponse.json({ error: "No store found for account" }, { status: 404 });
    }

    if (isStripeStubMode()) {
      return NextResponse.json({ error: "Payments setup is temporarily unavailable." }, { status: 409 });
    }

    const hasStripeEnv = stripeEnvSchema.safeParse({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    }).success;
    if (!hasStripeEnv) {
      return NextResponse.json({ error: "Payments setup is temporarily unavailable." }, { status: 503 });
    }

    if (isPlaceholderStripeKey(process.env.STRIPE_SECRET_KEY)) {
      return NextResponse.json({ error: "Payments setup is temporarily unavailable." }, { status: 503 });
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

    const appUrl = resolveAppUrlForRequest(request);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/stores/${bundle.store.slug}/store-settings/integrations?payments=refresh`,
      return_url: `${appUrl}/dashboard/stores/${bundle.store.slug}/store-settings/integrations?payments=return`,
      type: "account_onboarding"
    });

    return NextResponse.json({ accountId, onboardingUrl: accountLink.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start Stripe onboarding." }, { status: 500 });
  }
}
