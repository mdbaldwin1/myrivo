import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { collectAnalyticsSchema, dedupeEvents, sanitizeSessionId } from "@/lib/analytics/collect";
import { fail } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SESSION_COOKIE = "myrivo_analytics_sid";
const SESSION_COOKIE_AGE_SECONDS = 60 * 60 * 24 * 30;

function buildSessionId(input: { payloadSessionId?: string; cookieSessionId?: string }): string {
  const fromPayload = sanitizeSessionId(input.payloadSessionId);
  if (fromPayload) {
    return fromPayload;
  }
  const fromCookie = sanitizeSessionId(input.cookieSessionId);
  if (fromCookie) {
    return fromCookie;
  }
  return randomUUID().replaceAll("-", "");
}

type StoreRow = {
  id: string;
  slug: string;
  status: "draft" | "pending_review" | "active" | "suspended";
};

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    key: "analytics_collect",
    limit: 120,
    windowMs: 60_000
  });
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, collectAnalyticsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const supabase = createSupabaseAdminClient();
  const storeSlug = parsed.data.storeSlug.trim().toLowerCase();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,slug,status")
    .eq("slug", storeSlug)
    .maybeSingle<StoreRow>();

  if (storeError) {
    return fail(500, storeError.message);
  }
  if (!store) {
    return fail(404, "Store not found.");
  }
  if (store.status === "suspended") {
    return fail(403, "Store is not accepting analytics events.");
  }

  const sessionId = buildSessionId({
    payloadSessionId: parsed.data.sessionId,
    cookieSessionId: request.cookies.get(SESSION_COOKIE)?.value
  });
  const nowIso = new Date().toISOString();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("storefront_sessions")
    .upsert(
      {
        store_id: store.id,
        session_key: sessionId,
        last_seen_at: nowIso,
        user_agent: parsed.data.userAgent ?? request.headers.get("user-agent"),
        referrer: parsed.data.referrer ?? request.headers.get("referer"),
        entry_path: parsed.data.entryPath ?? parsed.data.events[0]?.path ?? null
      },
      { onConflict: "store_id,session_key" }
    )
    .select("id")
    .single<{ id: string }>();

  if (sessionError || !sessionRow) {
    return fail(500, sessionError?.message ?? "Unable to persist session.");
  }

  const events = dedupeEvents(parsed.data.events);
  const eventRows = events.map((event) => ({
    store_id: store.id,
    session_id: sessionRow.id,
    idempotency_key: event.idempotencyKey?.trim() || null,
    event_type: event.eventType,
    path: event.path ?? null,
    product_id: event.productId ?? null,
    cart_id: event.cartId ?? null,
    order_id: event.orderId ?? null,
    occurred_at: event.occurredAt ?? nowIso,
    value_json: event.value ?? {}
  }));

  const { error: insertError } = await supabase.from("storefront_events").upsert(eventRows, {
    onConflict: "store_id,idempotency_key",
    ignoreDuplicates: true
  });

  if (insertError) {
    return fail(500, insertError.message);
  }

  const response = NextResponse.json({
    ok: true,
    sessionId,
    acceptedEvents: eventRows.length
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    maxAge: SESSION_COOKIE_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return response;
}
