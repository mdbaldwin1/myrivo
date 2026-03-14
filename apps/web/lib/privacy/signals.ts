export type BrowserPrivacySignals = {
  globalPrivacyControlEnabled: boolean;
};

export function getDefaultBrowserPrivacySignals(): BrowserPrivacySignals {
  return {
    globalPrivacyControlEnabled: false
  };
}

export function resolveBrowserPrivacySignalsFromHeaders(headersLike: Pick<Headers, "get">): BrowserPrivacySignals {
  const secGpc = headersLike.get("sec-gpc")?.trim();
  const globalPrivacyControl = headersLike.get("global-privacy-control")?.trim();
  const dnt = headersLike.get("dnt")?.trim();

  return {
    globalPrivacyControlEnabled: secGpc === "1" || globalPrivacyControl === "1" || dnt === "1"
  };
}

export function resolveBrowserPrivacySignalsFromNavigator(): BrowserPrivacySignals {
  if (typeof navigator === "undefined") {
    return getDefaultBrowserPrivacySignals();
  }

  return {
    globalPrivacyControlEnabled:
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
      navigator.doNotTrack === "1"
  };
}

export function canEnableAnalyticsWithPrivacySignals(signals: BrowserPrivacySignals) {
  return !signals.globalPrivacyControlEnabled;
}
