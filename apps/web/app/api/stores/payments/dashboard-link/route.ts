import { NextRequest, NextResponse } from "next/server";
import { isStripeStubMode, stripeEnvSchema } from "@/lib/env";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    const bundle = await getOwnedStoreBundle(user.id, "admin");

    if (!bundle) {
      return NextResponse.json({ error: "No store found for account" }, { status: 404 });
    }

    if (isStripeStubMode()) {
      return NextResponse.json({ error: "Stripe dashboard access is temporarily unavailable." }, { status: 409 });
    }

    const hasStripeEnv = stripeEnvSchema.safeParse({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    }).success;
    if (!hasStripeEnv) {
      return NextResponse.json({ error: "Stripe dashboard access is temporarily unavailable." }, { status: 503 });
    }

    if (!bundle.store.stripe_account_id) {
      return NextResponse.json({ error: "Stripe account not connected." }, { status: 400 });
    }

    const loginLink = await getStripeClient().accounts.createLoginLink(bundle.store.stripe_account_id);

    return NextResponse.json({ dashboardUrl: loginLink.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open Stripe dashboard." }, { status: 500 });
  }
}
