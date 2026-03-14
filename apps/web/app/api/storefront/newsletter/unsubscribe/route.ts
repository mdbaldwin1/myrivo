import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";

const unsubscribeSchema = z.object({
  email: z.string().email().max(320),
  source: z.string().trim().max(80).optional().default("unsubscribe_form")
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "newsletter-unsubscribe",
    limit: 10,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = await parseJsonRequest(request, unsubscribeSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const unsubscribedAt = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);

  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; status: "draft" | "pending_review" | "active" | "suspended" }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store || store.status !== "active") {
    return NextResponse.json({ success: true });
  }

  const { data: existing, error: existingError } = await supabase
    .from("store_email_subscribers")
    .select("id,status")
    .eq("store_id", store.id)
    .ilike("email", email)
    .maybeSingle<{ id: string; status: "subscribed" | "unsubscribed" }>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing || existing.status === "unsubscribed") {
    return NextResponse.json({ success: true });
  }

  const { error: updateError } = await supabase
    .from("store_email_subscribers")
    .update({
      status: "unsubscribed",
      unsubscribed_at: unsubscribedAt,
      metadata_json: {
        suppression_reason: "user_unsubscribed",
        suppression_source: parsed.data.source.trim() || "unsubscribe_form",
        suppression_recorded_at: unsubscribedAt
      }
    })
    .eq("id", existing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, unsubscribed: true });
}
