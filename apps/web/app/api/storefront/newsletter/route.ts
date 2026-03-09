import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";

const subscribeSchema = z.object({
  email: z.string().email().max(320)
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "newsletter-subscribe",
    limit: 10,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = await parseJsonRequest(request, subscribeSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const email = parsed.data.email.trim().toLowerCase();
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
    return NextResponse.json({ error: "Newsletter signup is not available right now." }, { status: 400 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("store_settings")
    .select("email_capture_enabled")
    .eq("store_id", store.id)
    .maybeSingle<{ email_capture_enabled: boolean | null }>();

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  if (!settings?.email_capture_enabled) {
    return NextResponse.json({ error: "Newsletter signup is currently disabled." }, { status: 400 });
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

  if (existing) {
    if (existing.status === "subscribed") {
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    const { error: updateError } = await supabase
      .from("store_email_subscribers")
      .update({
        status: "subscribed",
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reactivated: true });
  }

  const { error: insertError } = await supabase.from("store_email_subscribers").insert({
    store_id: store.id,
    email,
    status: "subscribed",
    source: "storefront"
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
