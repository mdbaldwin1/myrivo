import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  createCookieConsentRecord,
  serializeCookieConsentForResponse
} from "@/lib/privacy/cookies";
import { canEnableAnalyticsWithPrivacySignals, resolveBrowserPrivacySignalsFromHeaders } from "@/lib/privacy/signals";
import { STOREFRONT_ANALYTICS_SESSION_COOKIE_NAME } from "@/lib/analytics/client";
import { MARKETING_ANALYTICS_COOKIE_NAME } from "@/lib/marketing/analytics";

function sanitizeReturnTo(input: FormDataEntryValue | null) {
  if (typeof input !== "string") {
    return "/";
  }

  const normalized = input.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/";
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const requestedAnalyticsEnabled = formData.get("analytics") === "true";
  const analyticsEnabled =
    requestedAnalyticsEnabled && canEnableAnalyticsWithPrivacySignals(resolveBrowserPrivacySignalsFromHeaders(request.headers));
  const returnTo = sanitizeReturnTo(formData.get("returnTo"));
  const consent = createCookieConsentRecord({ analytics: analyticsEnabled });
  const wantsJson = request.headers.get("x-myrivo-consent-request") === "1";

  const response = wantsJson
    ? NextResponse.json({
        ok: true,
        analytics: analyticsEnabled,
        returnTo
      })
    : NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
  response.cookies.set(COOKIE_CONSENT_COOKIE_NAME, serializeCookieConsentForResponse(consent), {
    path: "/",
    sameSite: "lax",
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
    secure: request.nextUrl.protocol === "https:"
  });

  if (!analyticsEnabled) {
    response.cookies.set(STOREFRONT_ANALYTICS_SESSION_COOKIE_NAME, "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
      secure: request.nextUrl.protocol === "https:"
    });
    response.cookies.set(MARKETING_ANALYTICS_COOKIE_NAME, "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
      secure: request.nextUrl.protocol === "https:"
    });
  }

  return response;
}
