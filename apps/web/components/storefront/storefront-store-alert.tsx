"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getStorefrontButtonRadiusClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import {
  buildStoreAlertDismissKey,
  getStoreAlertStudioPreview,
  resolveStoreAlertConfig,
  setStoreAlertStudioPreview,
  STOREFRONT_STORE_ALERT_PREVIEW_EVENT
} from "@/lib/storefront/store-alert";
import {
  resolveWelcomePopupConfig,
  STOREFRONT_WELCOME_POPUP_CLOSED_EVENT,
  STOREFRONT_WELCOME_POPUP_SURFACES
} from "@/lib/storefront/welcome-popup";
import type { StorefrontRuntime } from "@/lib/storefront/runtime";
import { cn } from "@/lib/utils";

type StorefrontStoreAlertProps = {
  runtime: StorefrontRuntime;
};

function isWelcomePopupExpectedThisVisit(runtime: StorefrontRuntime): boolean {
  if (runtime.viewer.canManageStore) {
    return false;
  }

  const welcomeConfig = resolveWelcomePopupConfig(runtime.settings);
  if (!welcomeConfig.enabled) {
    return false;
  }

  if (!(STOREFRONT_WELCOME_POPUP_SURFACES as readonly string[]).includes(runtime.surface)) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const convertedKey = `myrivo:welcome-popup:${runtime.store.slug}:converted`;
  if (window.localStorage.getItem(convertedKey) === "true") {
    return false;
  }

  const dismissKey = `myrivo:welcome-popup:${runtime.store.slug}:dismissed:${welcomeConfig.campaignKey}`;
  const dismissedUntil = Number.parseInt(window.localStorage.getItem(dismissKey) ?? "0", 10);
  if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
    return false;
  }

  return true;
}

export function StorefrontStoreAlert({ runtime }: StorefrontStoreAlertProps) {
  const [open, setOpen] = useState(false);
  const config = useMemo(() => resolveStoreAlertConfig(runtime.settings), [runtime.settings]);
  const buttonRadiusClass = getStorefrontButtonRadiusClass(runtime.themeConfig.radiusScale);
  const radiusClass = getStorefrontRadiusClass(runtime.themeConfig.radiusScale);
  const studioEnabled = runtime.mode === "studio";

  useEffect(() => {
    if (studioEnabled) {
      const syncPreview = () => {
        setOpen(getStoreAlertStudioPreview(runtime.store.slug) && config.enabled);
      };

      syncPreview();
      window.addEventListener(STOREFRONT_STORE_ALERT_PREVIEW_EVENT, syncPreview);
      return () => window.removeEventListener(STOREFRONT_STORE_ALERT_PREVIEW_EVENT, syncPreview);
    }

    if (runtime.viewer.canManageStore || !config.enabled || typeof window === "undefined") {
      return;
    }

    const dismissKey = buildStoreAlertDismissKey(runtime.store.slug, config.campaignKey);
    const dismissedUntil = Number.parseInt(window.localStorage.getItem(dismissKey) ?? "0", 10);
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
      return;
    }

    let timer: number | undefined;
    let welcomeListener: (() => void) | undefined;

    function scheduleOpen() {
      timer = window.setTimeout(() => setOpen(true), config.delaySeconds * 1000);
    }

    if (isWelcomePopupExpectedThisVisit(runtime)) {
      welcomeListener = () => {
        if (welcomeListener) {
          window.removeEventListener(STOREFRONT_WELCOME_POPUP_CLOSED_EVENT, welcomeListener);
          welcomeListener = undefined;
        }
        scheduleOpen();
      };
      window.addEventListener(STOREFRONT_WELCOME_POPUP_CLOSED_EVENT, welcomeListener);
    } else {
      scheduleOpen();
    }

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      if (welcomeListener) {
        window.removeEventListener(STOREFRONT_WELCOME_POPUP_CLOSED_EVENT, welcomeListener);
      }
    };
  }, [
    config.campaignKey,
    config.delaySeconds,
    config.enabled,
    runtime,
    studioEnabled
  ]);

  function dismiss() {
    setOpen(false);

    if (typeof window === "undefined") {
      return;
    }

    if (studioEnabled) {
      setStoreAlertStudioPreview(runtime.store.slug, false);
      return;
    }

    const dismissUntil = Date.now() + config.dismissDays * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(buildStoreAlertDismissKey(runtime.store.slug, config.campaignKey), String(dismissUntil));
  }

  if (!open || !config.enabled) {
    return null;
  }

  return (
    <div
      className={cn(
        "z-[80]",
        studioEnabled ? "absolute inset-0 overflow-y-auto" : "fixed inset-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="storefront-store-alert-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={dismiss} />
      <div
        className={cn(
          "relative z-[1] flex min-h-full justify-center px-4 py-6",
          studioEnabled ? "items-center" : "items-end sm:items-center"
        )}
      >
        <div
          className={cn(
            "relative w-full max-w-md overflow-hidden border border-border/70 bg-background shadow-[0_32px_90px_rgba(15,23,42,0.3)] [font-family:var(--storefront-font-body)]",
            radiusClass
          )}
        >
          <div className="space-y-4 p-6 sm:p-7">
            <div className="space-y-2">
              <p
                id="storefront-store-alert-title"
                className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground [font-family:var(--storefront-font-heading)]"
              >
                {config.title ?? "Heads up"}
              </p>
              <p className="whitespace-pre-line text-sm leading-6 text-foreground">{config.message}</p>
            </div>
            <Button type="button" className={cn("h-11 w-full", buttonRadiusClass)} onClick={dismiss}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
