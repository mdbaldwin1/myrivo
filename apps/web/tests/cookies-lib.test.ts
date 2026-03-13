import { describe, expect, test } from "vitest";
import {
  createCookieConsentRecord,
  getDefaultCookieConsent,
  hasAnalyticsConsent,
  resolveCookieConsent,
  serializeCookieConsent
} from "@/lib/privacy/cookies";

describe("cookie consent helpers", () => {
  test("returns the default consent state when no cookie is present", () => {
    expect(resolveCookieConsent(null)).toEqual(getDefaultCookieConsent());
  });

  test("round-trips a saved consent record", () => {
    const consent = createCookieConsentRecord({ analytics: true, updatedAt: "2026-03-13T00:00:00.000Z" });
    const parsed = resolveCookieConsent(serializeCookieConsent(consent));

    expect(parsed).toEqual(consent);
    expect(hasAnalyticsConsent(parsed)).toBe(true);
  });

  test("parses older double-encoded consent cookies", () => {
    const consent = createCookieConsentRecord({ analytics: false, updatedAt: "2026-03-13T00:00:00.000Z" });
    const parsed = resolveCookieConsent(encodeURIComponent(serializeCookieConsent(consent)));

    expect(parsed).toEqual(consent);
  });

  test("treats invalid cookie payloads as default consent", () => {
    expect(resolveCookieConsent("not-valid")).toEqual(getDefaultCookieConsent());
  });
});
