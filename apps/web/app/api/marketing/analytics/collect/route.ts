import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { collectMarketingAnalyticsRequestSchema, sanitizeMarketingSessionKey } from "@/lib/marketing/analytics";
import {
  extractMarketingUtmFields,
  sanitizeMarketingEventValue,
  sanitizeMarketingExperimentAssignments,
  sanitizeMarketingPath,
  sanitizeMarketingReferrer,
  sanitizeMarketingReferrerHost
} from "@/lib/marketing/analytics-governance";
import { COOKIE_CONSENT_COOKIE_NAME, hasAnalyticsConsent, resolveCookieConsent } from "@/lib/privacy/cookies";
import { canEnableAnalyticsWithPrivacySignals, resolveBrowserPrivacySignalsFromHeaders } from "@/lib/privacy/signals";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MARKETING_ANALYTICS_COOKIE_NAME = "myrivo_marketing_sid";
const MARKETING_ANALYTICS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function createSessionKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const parsed = collectMarketingAnalyticsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const consent = resolveCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null);
  const browserPrivacySignals = resolveBrowserPrivacySignalsFromHeaders(request.headers);
  if (!hasAnalyticsConsent(consent) || !canEnableAnalyticsWithPrivacySignals(browserPrivacySignals)) {
    return NextResponse.json({ ok: true, ignored: "analytics-disabled" });
  }

  const admin = createSupabaseAdminClient();
  const sanitizedEntryPath = sanitizeMarketingPath(parsed.data.entryPath);
  const sanitizedReferrer = sanitizeMarketingReferrer(parsed.data.referrer);
  const sessionKey =
    sanitizeMarketingSessionKey(parsed.data.sessionKey) ??
    sanitizeMarketingSessionKey(cookieStore.get(MARKETING_ANALYTICS_COOKIE_NAME)?.value ?? null) ??
    createSessionKey();
  const sessionAssignments = Object.assign(
    {},
    ...parsed.data.events.map((event) => sanitizeMarketingExperimentAssignments(event.experimentAssignments))
  );
  const utmFields = extractMarketingUtmFields(sanitizedEntryPath);
  const nowIso = new Date().toISOString();

  const sessionUpsertPayload = {
    session_key: sessionKey,
    entry_path: sanitizedEntryPath ?? null,
    landing_page_key: parsed.data.events.find((event) => event.eventType === "page_view")?.pageKey ?? null,
    referrer: sanitizedReferrer ?? null,
    referrer_host: sanitizeMarketingReferrerHost(sanitizedReferrer) ?? null,
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    first_utm_source: utmFields.utmSource ?? null,
    first_utm_medium: utmFields.utmMedium ?? null,
    first_utm_campaign: utmFields.utmCampaign ?? null,
    first_utm_term: utmFields.utmTerm ?? null,
    first_utm_content: utmFields.utmContent ?? null,
    last_utm_source: utmFields.utmSource ?? null,
    last_utm_medium: utmFields.utmMedium ?? null,
    last_utm_campaign: utmFields.utmCampaign ?? null,
    last_utm_term: utmFields.utmTerm ?? null,
    last_utm_content: utmFields.utmContent ?? null,
    experiment_assignments_json: sessionAssignments,
    updated_at: nowIso
  };

  const { data: session, error: sessionError } = await admin
    .from("marketing_sessions")
    .upsert(sessionUpsertPayload, { onConflict: "session_key" })
    .select("id")
    .single<{ id: string }>();

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message ?? "Unable to persist marketing session." }, { status: 500 });
  }

  const events = parsed.data.events.map((event) => ({
    session_id: session.id,
    event_type: event.eventType,
    occurred_at: nowIso,
    path: sanitizeMarketingPath(event.path ?? parsed.data.entryPath) ?? null,
    page_key: event.pageKey ?? null,
    section_key: event.sectionKey ?? null,
    cta_key: event.ctaKey ?? null,
    cta_label: event.ctaLabel ?? null,
    value_json: sanitizeMarketingEventValue(event),
    experiment_assignments_json: sanitizeMarketingExperimentAssignments(event.experimentAssignments),
    idempotency_key: event.idempotencyKey?.trim() || `${event.eventType}_${createSessionKey()}`
  }));

  const { error: eventsError } = await admin.from("marketing_events").upsert(events, { onConflict: "idempotency_key" });
  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, sessionKey });
  response.cookies.set(MARKETING_ANALYTICS_COOKIE_NAME, sessionKey, {
    path: "/",
    maxAge: MARKETING_ANALYTICS_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:"
  });
  return response;
}
