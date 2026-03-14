"use client";

import {
  useCallback,
  createContext,
  useEffect,
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
import {
  canEnableAnalyticsWithPrivacySignals,
  getDefaultBrowserPrivacySignals,
  resolveBrowserPrivacySignalsFromNavigator,
  type BrowserPrivacySignals
} from "@/lib/privacy/signals";

type CookieConsentContextValue = {
  consent: CookieConsentRecord;
  analyticsEnabled: boolean;
  globalPrivacyControlEnabled: boolean;
  openPreferences: () => void;
  savePreferences: (analyticsEnabled: boolean) => Promise<void>;
  setConsentChoice: (analyticsEnabled: boolean) => Promise<void>;
  acceptAll: () => Promise<void>;
  acceptEssentialOnly: () => Promise<void>;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function readConsentFromDocument() {
  if (typeof document === "undefined") {
    return getDefaultCookieConsent();
  }

  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));

  const rawValue = entry ? entry.slice(`${COOKIE_CONSENT_COOKIE_NAME}=`.length) : null;
  return resolveCookieConsent(rawValue);
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
  initialConsent: CookieConsentRecord;
  initialBrowserPrivacySignals?: BrowserPrivacySignals;
  children: ReactNode;
};

export function CookieConsentProvider({
  initialConsent,
  initialBrowserPrivacySignals = getDefaultBrowserPrivacySignals(),
  children
}: CookieConsentProviderProps) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<CookieConsentRecord>(initialConsent);
  const [browserPrivacySignals, setBrowserPrivacySignals] = useState<BrowserPrivacySignals>(initialBrowserPrivacySignals);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const globalPrivacyControlEnabled = browserPrivacySignals.globalPrivacyControlEnabled;
  const effectiveAnalyticsEnabled = consent.analytics && canEnableAnalyticsWithPrivacySignals(browserPrivacySignals);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncConsent = () => {
      setConsent(readConsentFromDocument());
    };

    window.addEventListener("pageshow", syncConsent);
    window.addEventListener("focus", syncConsent);
    window.addEventListener("myrivo:cookie-consent-sync", syncConsent as EventListener);

    return () => {
      window.removeEventListener("pageshow", syncConsent);
      window.removeEventListener("focus", syncConsent);
      window.removeEventListener("myrivo:cookie-consent-sync", syncConsent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncSignals = () => {
      setBrowserPrivacySignals(resolveBrowserPrivacySignalsFromNavigator());
    };

    syncSignals();
    window.addEventListener("pageshow", syncSignals);
    window.addEventListener("focus", syncSignals);

    return () => {
      window.removeEventListener("pageshow", syncSignals);
      window.removeEventListener("focus", syncSignals);
    };
  }, []);

  const saveConsent = useCallback((nextConsent: CookieConsentRecord) => {
    writeConsentToDocument(nextConsent);
    setConsent(nextConsent);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("myrivo:cookie-consent-sync"));
    }
  }, []);

  const persistConsent = useCallback(async (analyticsEnabled: boolean) => {
    const normalizedAnalyticsEnabled =
      analyticsEnabled && canEnableAnalyticsWithPrivacySignals(browserPrivacySignals);
    const nextConsent = createCookieConsentRecord({ analytics: normalizedAnalyticsEnabled });
    saveConsent(nextConsent);

    if (typeof window === "undefined") {
      return;
    }

    const formData = new FormData();
    formData.set("analytics", normalizedAnalyticsEnabled ? "true" : "false");
    formData.set("returnTo", `${window.location.pathname}${window.location.search}`);

    try {
      await fetch("/cookies/consent", {
        method: "POST",
        headers: {
          "x-myrivo-consent-request": "1"
        },
        body: formData,
        credentials: "same-origin"
      });
    } catch {
      // The optimistic local consent state is already applied. The next page load
      // will resync from the server cookie path if the request eventually succeeds.
    }
  }, [browserPrivacySignals, saveConsent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      if (window.location.hash === "#cookie-preferences" && shouldShowCookieUi(pathname)) {
        setPreferencesOpen(true);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [pathname]);

  const handlePreferencesOpenChange = (open: boolean) => {
    setPreferencesOpen(open);

    if (typeof window === "undefined") {
      return;
    }

    if (open) {
      if (window.location.hash !== "#cookie-preferences") {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#cookie-preferences`);
      }
      return;
    }

    if (window.location.hash === "#cookie-preferences") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  };

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      analyticsEnabled: effectiveAnalyticsEnabled,
      globalPrivacyControlEnabled,
      openPreferences: () => handlePreferencesOpenChange(true),
      savePreferences: async (analyticsEnabled) => {
        await persistConsent(analyticsEnabled);
        handlePreferencesOpenChange(false);
      },
      setConsentChoice: persistConsent,
      acceptAll: () => persistConsent(true),
      acceptEssentialOnly: () => persistConsent(false)
    }),
    [consent, effectiveAnalyticsEnabled, globalPrivacyControlEnabled, persistConsent]
  );

  const shouldRenderPublicUi = shouldShowCookieUi(pathname);

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {shouldRenderPublicUi ? (
        <>
          {!consent.hasRecordedChoice ? (
            <CookieConsentBanner onOpenPreferences={value.openPreferences} />
          ) : null}
          <CookiePreferencesSheet
            key={`${effectiveAnalyticsEnabled ? "analytics-on" : "analytics-off"}-${globalPrivacyControlEnabled ? "gpc-on" : "gpc-off"}-${preferencesOpen ? "open" : "closed"}`}
            open={preferencesOpen}
            analyticsEnabled={effectiveAnalyticsEnabled}
            globalPrivacyControlEnabled={globalPrivacyControlEnabled}
            onOpenChange={handlePreferencesOpenChange}
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
