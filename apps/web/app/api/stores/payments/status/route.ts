import { NextResponse } from "next/server";
import { isStripeStubMode, stripeEnvSchema } from "@/lib/env";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id);

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  if (!bundle.store.stripe_account_id) {
    const hasStripeEnv = stripeEnvSchema.safeParse({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    }).success;

    return NextResponse.json({
      connected: false,
      hasStripeEnv,
      mode: isStripeStubMode() ? "stub" : "live",
      readyForLiveCheckout: false
    });
  }

  try {
    const account = await getStripeClient().accounts.retrieve(bundle.store.stripe_account_id);
    const hasStripeEnv = stripeEnvSchema.safeParse({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    }).success;
    const mode = isStripeStubMode() ? "stub" : "live";
    const readyForLiveCheckout = Boolean(account.charges_enabled && account.payouts_enabled && hasStripeEnv && mode === "live");

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      hasStripeEnv,
      mode,
      readyForLiveCheckout
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      accountId: bundle.store.stripe_account_id,
      mode: isStripeStubMode() ? "stub" : "live",
      error: (error as Error).message
    });
  }
}
