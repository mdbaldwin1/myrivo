import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enqueueDigitalDelivery } from "@/lib/digital-products/delivery-jobs";
import { loadCheckoutDigitalAccessUrl } from "@/lib/digital-products/checkout-access";
import { getServerEnv, isStripeStubMode } from "@/lib/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { finalizeStorefrontCheckout, getStorefrontCheckoutBySessionId } from "@/lib/storefront/checkout-finalization";
import { getStripeClient } from "@/lib/stripe/server";
import type { CheckoutComposition } from "@/lib/storefront/checkout-composition";

const querySchema = z.object({
  sessionId: z.string().min(10)
});

async function completedCheckoutResponse(
  orderId: string | null,
  digitalManifestId: string | null,
  checkoutComposition: CheckoutComposition | null
) {
  if (!digitalManifestId) {
    return NextResponse.json({
      status: "completed",
      orderId,
      ...(checkoutComposition ? { checkoutComposition } : {})
    });
  }
  if (!orderId) {
    return NextResponse.json(
      { status: "pending", error: "Digital delivery is still being prepared." },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }

  try {
    const delivery = await enqueueDigitalDelivery(orderId, digitalManifestId);
    if (delivery.status === "failed") {
      return NextResponse.json(
        {
          status: "delivery_failed",
          orderId,
          digitalDeliveryStatus: "failed",
          error:
            "Payment was received, but the digital downloads could not be prepared. Contact the store for help with this order."
        },
        { status: 409 }
      );
    }
    const digitalAccessUrl = delivery.status === "succeeded"
      ? await loadCheckoutDigitalAccessUrl({
          orderId,
          jobId: delivery.id,
          secret: getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET?.trim() ?? ""
        })
      : null;
    return NextResponse.json({
      status: "completed",
      orderId,
      ...(checkoutComposition ? { checkoutComposition } : {}),
      digitalDeliveryStatus: delivery.status,
      ...(digitalAccessUrl ? { digitalAccessUrl } : {})
    });
  } catch {
    return NextResponse.json(
      { status: "pending", error: "Digital delivery is still being prepared." },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, {
    key: "checkout-status",
    limit: 60,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    sessionId: url.searchParams.get("sessionId")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
  }

  const { sessionId } = parsed.data;
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  try {
    const checkout = await getStorefrontCheckoutBySessionId(storeSlug, sessionId);

    if (!checkout) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    if (checkout.status === "completed") {
      return completedCheckoutResponse(
        checkout.order_id,
        checkout.digital_manifest_id,
        checkout.checkout_composition
      );
    }

    if (checkout.status === "failed") {
      return NextResponse.json({ status: "failed", error: checkout.error_message ?? "Checkout finalization failed." }, { status: 409 });
    }

    if (!isStripeStubMode()) {
      const session = await getStripeClient().checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

        const finalized = await finalizeStorefrontCheckout(
          checkout.id,
          paymentIntentId,
          session as unknown as { shipping_details?: { name?: string | null; address?: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null } | null } | null }
        );

        if (finalized.status === "completed") {
          return completedCheckoutResponse(
            finalized.orderId,
            checkout.digital_manifest_id,
            checkout.checkout_composition
          );
        }

      }
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
