import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import {
  getStorePrivacyOptOutStateLabel,
  getStorePrivacyOptOutsByStoreId,
  type StorePrivacyOptOutState
} from "@/lib/privacy/store-privacy";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import type { StorePrivacyOptOutRecord } from "@/types/database";

const updatePrivacyOptOutSchema = z.object({
  optOutId: z.string().uuid(),
  state: z.enum(["active", "revoked"])
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

function serializeOptOut(row: StorePrivacyOptOutRecord) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    state: row.state,
    state_label: getStorePrivacyOptOutStateLabel(row.state),
    source: row.source,
    latest_request_id: row.latest_request_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle } = resolved;
  const optOuts = await getStorePrivacyOptOutsByStoreId(supabase, bundle.store.id);

  return NextResponse.json({
    optOuts: optOuts.map(serializeOptOut)
  });
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updatePrivacyOptOutSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle, user } = resolved;
  const { error } = await supabase
    .from("store_privacy_opt_outs")
    .update({
      state: payload.data.state satisfies StorePrivacyOptOutState,
      metadata_json: {
        updated_by_operator: true
      }
    })
    .eq("store_id", bundle.store.id)
    .eq("id", payload.data.optOutId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store_privacy_opt_out",
    entityId: payload.data.optOutId,
    metadata: {
      state: payload.data.state
    }
  });

  const optOuts = await getStorePrivacyOptOutsByStoreId(supabase, bundle.store.id);
  return NextResponse.json({
    optOuts: optOuts.map(serializeOptOut)
  });
}
