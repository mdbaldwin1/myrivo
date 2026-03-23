import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { logAuditEvent } from "@/lib/audit/log";
import { resolveBrowserPrivacySignalsFromHeaders } from "@/lib/privacy/signals";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

const privacyRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().max(160).optional().default(""),
  requestType: z.enum(["access", "deletion", "correction", "know", "opt_out_sale_share"]),
  details: z.string().trim().max(4000).optional().default("")
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "storefront-privacy-request",
    limit: 8,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = await parseJsonRequest(request, privacyRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const browserPrivacySignals = resolveBrowserPrivacySignalsFromHeaders(request.headers);
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store || !isStorePubliclyAccessibleStatus(store.status)) {
    return NextResponse.json({ error: "Privacy requests are not available for this storefront right now." }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const normalizedFullName = parsed.data.fullName.trim() || null;
  const normalizedDetails = parsed.data.details.trim() || null;
  const requestMetadata = browserPrivacySignals.globalPrivacyControlEnabled ? { global_privacy_control: true } : {};

  const { data: insertedRequest, error: insertError } = await supabase
    .from("store_privacy_requests")
    .insert({
      store_id: store.id,
      email: normalizedEmail,
      full_name: normalizedFullName,
      request_type: parsed.data.requestType,
      details: normalizedDetails,
      source: "privacy_page",
      metadata_json: requestMetadata
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (parsed.data.requestType === "opt_out_sale_share") {
    const { error: optOutError } = await supabase.from("store_privacy_opt_outs").upsert(
      {
        store_id: store.id,
        email: normalizedEmail,
        full_name: normalizedFullName,
        state: "active",
        source: browserPrivacySignals.globalPrivacyControlEnabled ? "browser_signal" : "privacy_page",
        latest_request_id: insertedRequest?.id ?? null,
        metadata_json: requestMetadata
      },
      { onConflict: "store_id,email" }
    );

    if (optOutError) {
      return NextResponse.json({ error: optOutError.message }, { status: 500 });
    }

    await logAuditEvent({
      storeId: store.id,
      action: "create",
      entity: "store_privacy_opt_out",
      entityId: normalizedEmail,
      metadata: {
        email: normalizedEmail,
        source: browserPrivacySignals.globalPrivacyControlEnabled ? "browser_signal" : "privacy_page",
        global_privacy_control: browserPrivacySignals.globalPrivacyControlEnabled
      }
    });
  }

  await logAuditEvent({
    storeId: store.id,
    action: "create",
    entity: "store_privacy_request",
    entityId: insertedRequest?.id ?? null,
    metadata: {
      request_type: parsed.data.requestType,
      source: "privacy_page",
      global_privacy_control: browserPrivacySignals.globalPrivacyControlEnabled
    }
  });

  return NextResponse.json({ success: true });
}
