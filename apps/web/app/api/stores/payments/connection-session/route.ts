import { NextRequest, NextResponse } from "next/server";
import { getOptionalStripePublishableKey, isStripeStubMode, stripeEnvSchema } from "@/lib/env";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isPlaceholderStripeKey(secretKey: string | undefined): boolean {
  if (!secretKey) {
    return true;
  }

  return secretKey.includes("placeholder") || secretKey.includes("local_placeholder");
}

export async function POST(request: NextRequest) {
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

  const storeSlug = request.nextUrl.searchParams.get("storeSlug");
  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, "admin");

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

  if (!hasStripeEnv || isPlaceholderStripeKey(process.env.STRIPE_SECRET_KEY)) {
    return NextResponse.json({ error: "Payments setup is temporarily unavailable." }, { status: 503 });
  }

  const publishableKey = getOptionalStripePublishableKey();
  if (!publishableKey) {
    return NextResponse.json({ error: "Missing Stripe publishable key configuration." }, { status: 503 });
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

  try {
    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: {
          enabled: true
        },
        notification_banner: {
          enabled: true
        }
      }
    });

    return NextResponse.json({
      publishableKey,
      clientSecret: accountSession.client_secret,
      accountId
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to open Stripe account setup."
      },
      { status: 500 }
    );
  }
}
