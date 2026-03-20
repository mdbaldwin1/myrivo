import { NextResponse } from "next/server";
import { getOptionalStripePublishableKey } from "@/lib/env";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeSlug = new URL(request.url).searchParams.get("storeSlug");
  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, "admin");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  if (!bundle.store.stripe_account_id) {
    return NextResponse.json({ error: "Connect Stripe before configuring Stripe Tax." }, { status: 409 });
  }

  const publishableKey = getOptionalStripePublishableKey();
  if (!publishableKey) {
    return NextResponse.json({ error: "Missing Stripe publishable key configuration." }, { status: 503 });
  }

  try {
    const accountSession = await getStripeClient().accountSessions.create({
      account: bundle.store.stripe_account_id,
      components: {
        tax_settings: {
          enabled: true
        },
        tax_registrations: {
          enabled: true
        }
      }
    });

    return NextResponse.json({
      publishableKey,
      clientSecret: accountSession.client_secret
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to start Stripe Tax setup."
      },
      { status: 500 }
    );
  }
}
