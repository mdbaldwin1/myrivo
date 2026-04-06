import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isStripeStubMode } from "@/lib/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { finalizeStorefrontCheckout, getStorefrontCheckoutBySessionId } from "@/lib/storefront/checkout-finalization";
import { getStripeClient } from "@/lib/stripe/server";

const querySchema = z.object({
  sessionId: z.string().min(10)
});

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
      return NextResponse.json({ status: "completed", orderId: checkout.order_id });
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
          return NextResponse.json({ status: "completed", orderId: finalized.orderId });
        }

        if (finalized.status === "failed") {
          return NextResponse.json({ status: "failed", error: finalized.errorMessage ?? "Checkout finalization failed." }, { status: 409 });
        }
      }
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
