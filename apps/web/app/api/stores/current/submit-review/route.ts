import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit/log";
import { notifyOwnersStoreSubmittedForReview, notifyPlatformAdminsStoreSubmittedForReview } from "@/lib/notifications/owner-notifications";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";

export async function POST(request: NextRequest) {
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

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "admin");
  if (!bundle) {
    return NextResponse.json({ error: "Store not found or insufficient permissions." }, { status: 403 });
  }

  if (!["draft", "changes_requested", "rejected"].includes(bundle.store.status)) {
    return NextResponse.json({ error: "Only draft stores or stores awaiting revisions can be submitted for review." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("stores")
    .update({ status: "pending_review", status_reason_code: null, status_reason_detail: null })
    .eq("id", bundle.store.id)
    .eq("status", bundle.store.status)
    .select("id,name,slug,status")
    .maybeSingle<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Store could not be submitted for review." }, { status: 409 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store",
    entityId: bundle.store.id,
    metadata: {
      fromStatus: "draft",
      toStatus: "pending_review",
      source: "owner_submit_review"
    }
  });

  await Promise.allSettled([
    notifyOwnersStoreSubmittedForReview({
      storeId: bundle.store.id,
      storeSlug: bundle.store.slug,
      submittedByUserId: user.id
    }),
    notifyPlatformAdminsStoreSubmittedForReview({
      storeId: bundle.store.id,
      storeSlug: bundle.store.slug,
      storeName: bundle.store.name,
      submittedByUserId: user.id
    })
  ]);

  return NextResponse.json({ store: data, ok: true });
}
