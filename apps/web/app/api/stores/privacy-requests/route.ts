import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { getStorePrivacyRequestsByStoreId } from "@/lib/privacy/store-privacy";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import type { StorePrivacyRequestRecord } from "@/types/database";

const updatePrivacyRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "completed", "closed"])
});

async function resolveOwnerContext(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "admin");
  if (!bundle) {
    return { error: NextResponse.json({ error: "Store not found or insufficient access." }, { status: 404 }) } as const;
  }

  return { supabase, bundle, user } as const;
}

function serializeRequest(row: StorePrivacyRequestRecord) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    request_type: row.request_type,
    status: row.status,
    source: row.source,
    metadata_json: row.metadata_json,
    details: row.details,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at
  };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle } = resolved;
  const requests = await getStorePrivacyRequestsByStoreId(supabase, bundle.store.id);

  return NextResponse.json({
    requests: requests.map(serializeRequest)
  });
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updatePrivacyRequestSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle, user } = resolved;
  const resolvedAt = payload.data.status === "completed" || payload.data.status === "closed" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("store_privacy_requests")
    .update({
      status: payload.data.status,
      resolved_at: resolvedAt,
      resolved_by_user_id: resolvedAt ? user.id : null
    })
    .eq("store_id", bundle.store.id)
    .eq("id", payload.data.requestId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store_privacy_request",
    entityId: payload.data.requestId,
    metadata: {
      status: payload.data.status
    }
  });

  const requests = await getStorePrivacyRequestsByStoreId(supabase, bundle.store.id);
  return NextResponse.json({
    requests: requests.map(serializeRequest)
  });
}
