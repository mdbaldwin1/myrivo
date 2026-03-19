import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markOnboardingMilestone } from "@/lib/onboarding/analytics";
import { saveOnboardingFirstProduct } from "@/lib/onboarding/first-product";
import { getOnboardingSessionBundleForUser, updateOnboardingSession } from "@/lib/onboarding/session";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const onboardingFirstProductSchema = z.object({
  storeId: z.string().uuid(),
  firstProduct: z.object({
    title: z.string().min(2),
    description: z.string().optional().default(""),
    priceDollars: z.string().optional().default(""),
    optionMode: z.enum(["none", "single_axis", "two_axis"]),
    inventoryMode: z.enum(["in_stock", "made_to_order"])
  })
});

type FirstProductRouteProps = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, { params }: FirstProductRouteProps) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const body = await request.json().catch(() => null);
  const payload = onboardingFirstProductSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { sessionId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOnboardingSessionBundleForUser(user.id, payload.data.storeId);
  if (!bundle || bundle.session.id !== sessionId) {
    return NextResponse.json({ error: "Onboarding session not found." }, { status: 404 });
  }

  try {
    const savedProduct = await saveOnboardingFirstProduct({
      storeId: bundle.store.id,
      userId: user.id,
      existingProductId: bundle.session.first_product_id,
      firstProduct: payload.data.firstProduct
    });

    await updateOnboardingSession({
      sessionId,
      storeId: bundle.store.id,
      firstProductId: savedProduct.productId,
      currentStep: "firstProduct"
    });
    await markOnboardingMilestone({
      sessionId,
      storeId: bundle.store.id,
      milestone: "first_product_completed"
    });

    return NextResponse.json({
      ok: true,
      productId: savedProduct.productId,
      productTitle: savedProduct.productTitle
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save the onboarding product."
      },
      { status: 500 }
    );
  }
}
