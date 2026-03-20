import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  notifyOwnersStoreSubmittedForReview,
  notifyOwnersSystemSetupWarning,
  notifyPlatformAdminsStoreSubmittedForReview
} from "@/lib/notifications/owner-notifications";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getStoreStripePaymentsReadiness } from "@/lib/stripe/store-payments-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreOnboardingProgressForStore } from "@/lib/stores/onboarding";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { ACTIVE_STORE_COOKIE } from "@/lib/stores/tenant-context";

const launchSchema = z.object({
  slug: z.string().min(3).max(63)
});

function isSecureCookieRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }
  return request.nextUrl.protocol.toLowerCase() === "https:";
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, launchSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const slug = payload.data.slug.trim().toLowerCase();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, slug, "admin");
  if (!bundle) {
    return NextResponse.json({ error: "Store not found or insufficient permissions." }, { status: 403 });
  }

  const progress = await getStoreOnboardingProgressForStore(user.id, slug);
  if (!progress) {
    return NextResponse.json({ error: "Store onboarding status not found." }, { status: 404 });
  }

  const paymentsReadyForLaunch = progress.steps.payments
    ? (await getStoreStripePaymentsReadiness(bundle.store.stripe_account_id)).readyForLiveCheckout
    : false;

  if (!progress.launchReady || !paymentsReadyForLaunch) {
    const missingSteps = [
      !progress.steps.profile ? "Store profile" : null,
      !progress.steps.branding ? "Branding" : null,
      !progress.steps.firstProduct ? "First product" : null,
      !progress.steps.payments || !paymentsReadyForLaunch ? "Payments" : null
    ].filter((step): step is string => step !== null);

    try {
      await notifyOwnersSystemSetupWarning({
        storeId: progress.id,
        storeSlug: progress.slug,
        missingSteps,
        source: "onboarding_launch",
        actorUserId: user.id
      });
    } catch {
      // Do not block launch readiness checks on notification dispatch errors.
    }

    return NextResponse.json(
      { error: "Complete profile, branding, first product, and Stripe payments setup before launching this store." },
      { status: 409 }
    );
  }

  if (progress.status === "live") {
    return NextResponse.json({ ok: true, store: { id: progress.id, slug: progress.slug, status: "live" } });
  }

  if (progress.status === "pending_review") {
    return NextResponse.json({ ok: true, store: { id: progress.id, slug: progress.slug, status: "pending_review" } });
  }

  if (!["draft", "changes_requested", "rejected"].includes(progress.status)) {
    return NextResponse.json({ error: "This store cannot be submitted for review right now." }, { status: 409 });
  }

  const { error } = await supabase
    .from("stores")
    .update({ status: "pending_review", status_reason_code: null, status_reason_detail: null })
    .eq("id", progress.id)
    .eq("status", progress.status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: progress.id,
    actorUserId: user.id,
    action: "update",
    entity: "store",
    entityId: progress.id,
    metadata: {
      fromStatus: progress.status,
      toStatus: "pending_review",
      source: "onboarding_launch"
    }
  });

  await Promise.allSettled([
    notifyOwnersStoreSubmittedForReview({
      storeId: progress.id,
      storeSlug: progress.slug,
      submittedByUserId: user.id
    }),
    notifyPlatformAdminsStoreSubmittedForReview({
      storeId: progress.id,
      storeSlug: progress.slug,
      storeName: progress.name,
      submittedByUserId: user.id
    })
  ]);

  const response = NextResponse.json({ ok: true, store: { id: progress.id, slug: progress.slug, status: "pending_review" } });
  response.cookies.set(ACTIVE_STORE_COOKIE, progress.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieRequest(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });
  return response;
}
