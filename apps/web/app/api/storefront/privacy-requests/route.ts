import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";

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
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; status: "draft" | "pending_review" | "active" | "suspended" }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store || store.status !== "active") {
    return NextResponse.json({ error: "Privacy requests are not available for this storefront right now." }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("store_privacy_requests").insert({
    store_id: store.id,
    email: parsed.data.email.trim().toLowerCase(),
    full_name: parsed.data.fullName.trim() || null,
    request_type: parsed.data.requestType,
    details: parsed.data.details.trim() || null,
    source: "privacy_page",
    metadata_json: {}
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
