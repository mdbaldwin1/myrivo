import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeEnv, isStripeStubMode } from "@/lib/env";
import { finalizeStorefrontCheckout, markStorefrontCheckoutFailed } from "@/lib/storefront/checkout-finalization";
import { getStripeClient } from "@/lib/stripe/server";

export async function POST(request: Request) {
  if (isStripeStubMode()) {
    return NextResponse.json({ received: true, mode: "stub" });
  }

  const payload = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(payload, signature, getStripeEnv().STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ error: `Invalid signature: ${(error as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutKind = session.metadata?.checkout_kind;

    if (checkoutKind === "storefront_order") {
      const checkoutId = session.metadata?.storefront_checkout_id;

      if (checkoutId) {
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        if (session.payment_status === "paid") {
          await finalizeStorefrontCheckout(checkoutId, paymentIntentId);
        }
      }

      return NextResponse.json({ received: true, checkoutKind });
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutKind = session.metadata?.checkout_kind;
    const checkoutId = session.metadata?.storefront_checkout_id;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

    if (checkoutKind === "storefront_order" && checkoutId) {
      await markStorefrontCheckoutFailed(checkoutId, "Checkout session payment failed.", paymentIntentId);
      return NextResponse.json({ received: true, checkoutKind });
    }

  }

  return NextResponse.json({ received: true });
}
