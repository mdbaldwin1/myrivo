import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeEnv, isStripeStubMode } from "@/lib/env";
import { syncStripeDisputeRecord, syncStripeRefundRecord } from "@/lib/orders/refund-dispute-sync";
import { finalizeStorefrontCheckout, markStorefrontCheckoutFailed } from "@/lib/storefront/checkout-finalization";
import {
  beginStripeWebhookEventProcessing,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed
} from "@/lib/stripe/webhook-events";
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

  const reservation = await beginStripeWebhookEventProcessing(event.id, event.type);
  if (!reservation.shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true, type: event.type });
  }

  try {
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

        await markStripeWebhookEventProcessed(event.id);
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
        await markStripeWebhookEventProcessed(event.id);
        return NextResponse.json({ received: true, checkoutKind });
      }
    }

    if (event.type === "refund.created" || event.type === "refund.updated" || event.type === "charge.refund.updated") {
      const refund = event.data.object as Stripe.Refund;
      await syncStripeRefundRecord(refund);
      await markStripeWebhookEventProcessed(event.id);
      return NextResponse.json({ received: true, type: event.type });
    }

    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.updated" ||
      event.type === "charge.dispute.closed" ||
      event.type === "charge.dispute.funds_withdrawn" ||
      event.type === "charge.dispute.funds_reinstated"
    ) {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;

      if (!paymentIntentId && dispute.charge) {
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
        const charge = await getStripeClient().charges.retrieve(chargeId);
        dispute.payment_intent = charge.payment_intent;
      }

      await syncStripeDisputeRecord(dispute);
      await markStripeWebhookEventProcessed(event.id);
      return NextResponse.json({ received: true, type: event.type });
    }

    await markStripeWebhookEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook processing failed.";
    await markStripeWebhookEventFailed(event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
