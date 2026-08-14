import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queueMerchantDigitalDeliveryResend } from "@/lib/digital-products/delivery-email";
import { getServerEnv } from "@/lib/env";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const paramsSchema = z.object({ orderId: z.string().uuid() });
const idempotencyKeySchema = z.string().trim().min(1).max(128);

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;

  const params = paramsSchema.safeParse(await context.params);
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!params.success || !idempotencyKey.success) {
    return NextResponse.json({ error: "Invalid resend request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const tokenSecret = getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET?.trim();
  if (!tokenSecret) {
    return NextResponse.json(
      { error: "Digital delivery is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const result = await queueMerchantDigitalDeliveryResend({
      orderId: params.data.orderId,
      storeId: bundle.store.id,
      actorUserId: user.id,
      idempotencyKey: idempotencyKey.data,
      tokenSecret,
    });
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Digital delivery is not eligible for resend." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { status: "queued", duplicate: result.duplicate },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      { error: "Digital delivery resend could not be queued." },
      { status: 500 },
    );
  }
}
