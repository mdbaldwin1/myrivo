import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveStoreAnalyticsAccessByStoreId } from "@/lib/analytics/access";
import { buildStorefrontAttributionTouch } from "@/lib/analytics/attribution";
import { collectAnalyticsSchema, dedupeEvents, sanitizeSessionId } from "@/lib/analytics/collect";
import {
  sanitizeStorefrontAnalyticsEventValue,
  sanitizeStorefrontAttributionSnapshot,
  sanitizeStorefrontSessionContext
} from "@/lib/analytics/governance";
import { fail } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { COOKIE_CONSENT_COOKIE_NAME, hasAnalyticsConsent, resolveCookieConsent } from "@/lib/privacy/cookies";
import { canEnableAnalyticsWithPrivacySignals, resolveBrowserPrivacySignalsFromHeaders } from "@/lib/privacy/signals";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
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

function buildEventIdempotencyKey(input?: string) {
  const normalized = input?.trim();
  if (normalized) {
    return normalized;
  }

  return `evt_${randomUUID().replaceAll("-", "")}`;
}

type StoreRow = {
  id: string;
  slug: string;
  status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
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
  if (!isStorePubliclyAccessibleStatus(store.status)) {
    return fail(403, "Store is not accepting analytics events.");
  }

  const analyticsAccess = await resolveStoreAnalyticsAccessByStoreId(supabase, store.id);
  const consent = resolveCookieConsent(request.cookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value);
  const browserPrivacySignals = resolveBrowserPrivacySignalsFromHeaders(request.headers);

  const sessionId = buildSessionId({
    payloadSessionId: parsed.data.sessionId,
    cookieSessionId: request.cookies.get(SESSION_COOKIE)?.value
  });

  if (
    !analyticsAccess.collectionEnabled ||
    !hasAnalyticsConsent(consent) ||
    !canEnableAnalyticsWithPrivacySignals(browserPrivacySignals)
  ) {
    return NextResponse.json({
      ok: true,
      acceptedEvents: 0
    });
  }

  const nowIso = new Date().toISOString();
  const sessionContext = sanitizeStorefrontSessionContext({
    entryPath: parsed.data.entryPath ?? parsed.data.events[0]?.path ?? null,
    referrer: parsed.data.referrer ?? request.headers.get("referer"),
    userAgent: parsed.data.userAgent ?? request.headers.get("user-agent"),
    storeSlug: store.slug
  });
  const fallbackTouch = buildStorefrontAttributionTouch({
    entryPath: sessionContext.entryPath ?? null,
    referrer: sessionContext.referrer ?? null,
    storeSlug: store.slug
  });
  const sanitizedAttribution = sanitizeStorefrontAttributionSnapshot(parsed.data.attribution, store.slug);
  const firstTouch = sanitizedAttribution?.firstTouch ?? fallbackTouch;
  const lastTouch = sanitizedAttribution?.lastTouch ?? fallbackTouch;

  const { data: sessionRow, error: sessionError } = await supabase
    .from("storefront_sessions")
    .upsert(
      {
        store_id: store.id,
        session_key: sessionId,
        last_seen_at: nowIso,
        user_agent: sessionContext.userAgent ?? null,
        referrer: sessionContext.referrer ?? null,
        entry_path: sessionContext.entryPath ?? null,
        first_entry_path: firstTouch?.entryPath ?? null,
        first_referrer_url: firstTouch?.referrerUrl ?? null,
        first_referrer_host: firstTouch?.referrerHost ?? null,
        first_utm_source: firstTouch?.utmSource ?? null,
        first_utm_medium: firstTouch?.utmMedium ?? null,
        first_utm_campaign: firstTouch?.utmCampaign ?? null,
        first_utm_term: firstTouch?.utmTerm ?? null,
        first_utm_content: firstTouch?.utmContent ?? null,
        last_entry_path: lastTouch?.entryPath ?? null,
        last_referrer_url: lastTouch?.referrerUrl ?? null,
        last_referrer_host: lastTouch?.referrerHost ?? null,
        last_utm_source: lastTouch?.utmSource ?? null,
        last_utm_medium: lastTouch?.utmMedium ?? null,
        last_utm_campaign: lastTouch?.utmCampaign ?? null,
        last_utm_term: lastTouch?.utmTerm ?? null,
        last_utm_content: lastTouch?.utmContent ?? null
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
    idempotency_key: buildEventIdempotencyKey(event.idempotencyKey),
    event_type: event.eventType,
    path: event.path ?? null,
    product_id: event.productId ?? null,
    cart_id: event.cartId ?? null,
    order_id: event.orderId ?? null,
    occurred_at: event.occurredAt ?? nowIso,
    value_json: sanitizeStorefrontAnalyticsEventValue(event)
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
