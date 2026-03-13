"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";
import { CookieConsentBanner } from "@/components/privacy/cookie-consent-banner";
import { CookiePreferencesSheet } from "@/components/privacy/cookie-preferences-sheet";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  createCookieConsentRecord,
  getDefaultCookieConsent,
  resolveCookieConsent,
  serializeCookieConsent,
  type CookieConsentRecord
} from "@/lib/privacy/cookies";
import { getStorefrontButtonRadiusClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import type { RadiusScale } from "@/lib/theme/storefront-theme";

type CookieConsentContextValue = {
  consent: CookieConsentRecord;
  analyticsEnabled: boolean;
  openPreferences: () => void;
  savePreferences: (analyticsEnabled: boolean) => void;
  acceptAll: () => void;
  acceptEssentialOnly: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function readCookieUiThemeFromDocument() {
  if (typeof document === "undefined") {
    return {
      storefrontStyled: false,
      buttonRadiusClass: "",
      surfaceRadiusClass: ""
    };
  }

  const radiusScale = document.body.dataset.storefrontRadiusScale as RadiusScale | undefined;
  const storefrontStyled = document.body.dataset.cookieTheme === "storefront" && Boolean(radiusScale);

  return {
    storefrontStyled,
    buttonRadiusClass: storefrontStyled && radiusScale ? getStorefrontButtonRadiusClass(radiusScale) : "",
    surfaceRadiusClass: storefrontStyled && radiusScale ? getStorefrontRadiusClass(radiusScale) : ""
  };
}

function readConsentFromDocument() {
  if (typeof document === "undefined") {
    return getDefaultCookieConsent();
  }

  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));

  return resolveCookieConsent(entry ? entry.slice(`${COOKIE_CONSENT_COOKIE_NAME}=`.length) : null);
}

function writeConsentToDocument(consent: CookieConsentRecord) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsent(consent)}; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

function shouldShowCookieUi(pathname: string | null) {
  if (!pathname) {
    return true;
  }

  return !pathname.startsWith("/dashboard");
}

type CookieConsentProviderProps = {
  children: ReactNode;
};

export function CookieConsentProvider({ children }: CookieConsentProviderProps) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<CookieConsentRecord>(() =>
    typeof document === "undefined" ? getDefaultCookieConsent() : readConsentFromDocument()
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const cookieUiTheme = readCookieUiThemeFromDocument();

  const saveConsent = (nextConsent: CookieConsentRecord) => {
    writeConsentToDocument(nextConsent);
    setConsent(nextConsent);
  };

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      analyticsEnabled: consent.analytics,
      openPreferences: () => setPreferencesOpen(true),
      savePreferences: (analyticsEnabled) => saveConsent(createCookieConsentRecord({ analytics: analyticsEnabled })),
      acceptAll: () => saveConsent(createCookieConsentRecord({ analytics: true })),
      acceptEssentialOnly: () => saveConsent(createCookieConsentRecord({ analytics: false }))
    }),
    [consent]
  );

  const shouldRenderPublicUi = shouldShowCookieUi(pathname);

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {shouldRenderPublicUi ? (
        <>
          {!consent.hasRecordedChoice ? (
            <CookieConsentBanner
              storefrontStyled={cookieUiTheme.storefrontStyled}
              buttonRadiusClass={cookieUiTheme.buttonRadiusClass}
              surfaceRadiusClass={cookieUiTheme.surfaceRadiusClass}
              onAcceptAll={value.acceptAll}
              onAcceptEssentialOnly={value.acceptEssentialOnly}
              onOpenPreferences={value.openPreferences}
            />
          ) : null}
          <CookiePreferencesSheet
            key={`${consent.analytics ? "analytics-on" : "analytics-off"}-${preferencesOpen ? "open" : "closed"}`}
            open={preferencesOpen}
            analyticsEnabled={consent.analytics}
            storefrontStyled={cookieUiTheme.storefrontStyled}
            buttonRadiusClass={cookieUiTheme.buttonRadiusClass}
            surfaceRadiusClass={cookieUiTheme.surfaceRadiusClass}
            onOpenChange={setPreferencesOpen}
            onSave={value.savePreferences}
          />
        </>
      ) : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return context;
}

export function useOptionalCookieConsent() {
  return useContext(CookieConsentContext);
}
