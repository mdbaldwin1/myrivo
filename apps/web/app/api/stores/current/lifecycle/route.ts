import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { notifyOwnersStoreStatusChanged } from "@/lib/notifications/owner-notifications";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { expirePendingStorefrontCheckoutSessions } from "@/lib/storefront/checkout-finalization";

const lifecycleActionSchema = z.object({
  action: z.enum(["go_live", "go_offline"])
});

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, lifecycleActionSchema);
  if (!payload.ok) {
    return payload.response;
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

  const currentStatus = bundle.store.status;
  const { action } = payload.data;

  if (action === "go_offline" && currentStatus !== "live") {
    return NextResponse.json({ error: "Only live stores can be taken offline." }, { status: 409 });
  }

  if (action === "go_live" && currentStatus !== "offline") {
    return NextResponse.json({ error: "Only offline stores can be brought live." }, { status: 409 });
  }

  const nextStatus = action === "go_live" ? "live" : "offline";

  const updatePayload = {
    status: nextStatus,
    has_launched_once: action === "go_live" ? true : bundle.store.has_launched_once,
    status_reason_code: null,
    status_reason_detail: null
  };

  let { data, error } = await supabase
    .from("stores")
    .update(updatePayload)
    .eq("id", bundle.store.id)
    .eq("status", currentStatus)
    .select("id,name,slug,status")
    .maybeSingle();

  if (error && isMissingColumnInSchemaCache(error, "has_launched_once")) {
    ({ data, error } = await supabase
      .from("stores")
      .update({
        status: nextStatus,
        status_reason_code: null,
        status_reason_detail: null
      })
      .eq("id", bundle.store.id)
      .eq("status", currentStatus)
      .select("id,name,slug,status")
      .maybeSingle());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Unable to update store status." }, { status: 409 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store",
    entityId: bundle.store.id,
    metadata: {
      fromStatus: currentStatus,
      toStatus: nextStatus,
      reviewAction: action,
      source: "owner_lifecycle"
    }
  });

  const backgroundTasks = [
    notifyOwnersStoreStatusChanged({
      storeId: bundle.store.id,
      storeSlug: bundle.store.slug,
      action,
      actorUserId: user.id
    })
  ];

  if (action === "go_offline") {
    backgroundTasks.push(expirePendingStorefrontCheckoutSessions(bundle.store.id));
  }

  await Promise.allSettled(backgroundTasks);

  return NextResponse.json({ ok: true, store: data });
}
