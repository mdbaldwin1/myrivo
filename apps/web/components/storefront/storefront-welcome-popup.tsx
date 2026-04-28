"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorefrontStudioEditableInputPlaceholder } from "@/components/storefront/storefront-studio-editable-input-placeholder";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { StorefrontStudioEditableWelcomePopupImage } from "@/components/storefront/storefront-studio-editable-welcome-popup-image";
import { ensureStorefrontSettingsDraft } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import {
  getWelcomePopupStudioPreview,
  resolveWelcomePopupConfig,
  setWelcomePopupStudioPreview,
  STOREFRONT_WELCOME_POPUP_CLOSED_EVENT,
  STOREFRONT_WELCOME_POPUP_PREVIEW_EVENT,
  STOREFRONT_WELCOME_POPUP_SOURCE,
  STOREFRONT_WELCOME_POPUP_SURFACES
} from "@/lib/storefront/welcome-popup";
import type { StorefrontRuntime } from "@/lib/storefront/runtime";
import { getStorefrontButtonRadiusClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { cn } from "@/lib/utils";

type StorefrontWelcomePopupProps = {
  runtime: StorefrontRuntime;
};

type SubscribeResponse = {
  success?: boolean;
  alreadySubscribed?: boolean;
  reactivated?: boolean;
  welcomeEmailSent?: boolean;
  error?: string;
};

function buildDismissKey(storeSlug: string, campaignKey: string) {
  return `myrivo:welcome-popup:${storeSlug}:dismissed:${campaignKey}`;
}

function buildConvertedKey(storeSlug: string) {
  return `myrivo:welcome-popup:${storeSlug}:converted`;
}

export function StorefrontWelcomePopup({ runtime }: StorefrontWelcomePopupProps) {
  const pathname = usePathname();
  const studioDocument = useOptionalStorefrontStudioDocument();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const config = useMemo(() => resolveWelcomePopupConfig(runtime.settings), [runtime.settings]);
  const buttonRadiusClass = getStorefrontButtonRadiusClass(runtime.themeConfig.radiusScale);
  const radiusClass = getStorefrontRadiusClass(runtime.themeConfig.radiusScale);
  const canShowOnSurface = (STOREFRONT_WELCOME_POPUP_SURFACES as readonly string[]).includes(runtime.surface);
  const studioEnabled = runtime.mode === "studio" && Boolean(studioDocument);
  const studioPopupEnabled = Boolean(runtime.settings?.welcome_popup_enabled);
  const hasImageSlot = Boolean(config.imagePath) || studioEnabled;

  useEffect(() => {
    if (runtime.mode === "studio") {
      const syncPreview = () => {
        setOpen(getWelcomePopupStudioPreview(runtime.store.slug) && canShowOnSurface && studioPopupEnabled);
      };

      syncPreview();
      window.addEventListener(STOREFRONT_WELCOME_POPUP_PREVIEW_EVENT, syncPreview);
      return () => window.removeEventListener(STOREFRONT_WELCOME_POPUP_PREVIEW_EVENT, syncPreview);
    }

    if (runtime.viewer.canManageStore || !config.enabled || !canShowOnSurface) {
      setOpen(false);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const convertedKey = buildConvertedKey(runtime.store.slug);
    if (window.localStorage.getItem(convertedKey) === "true") {
      return;
    }

    const dismissKey = buildDismissKey(runtime.store.slug, config.campaignKey);
    const dismissedUntil = Number.parseInt(window.localStorage.getItem(dismissKey) ?? "0", 10);
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
      return;
    }

    const timer = window.setTimeout(() => setOpen(true), config.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [
    canShowOnSurface,
    config.campaignKey,
    config.delaySeconds,
    config.enabled,
    runtime.mode,
    runtime.store.slug,
    runtime.surface,
    runtime.viewer.canManageStore,
    studioPopupEnabled
  ]);

  function dismiss(reason: "close" | "subscribed") {
    setOpen(false);
    setError(null);
    if (typeof window === "undefined") {
      return;
    }

    if (runtime.mode === "studio") {
      setWelcomePopupStudioPreview(runtime.store.slug, false);
      return;
    }

    window.dispatchEvent(new CustomEvent(STOREFRONT_WELCOME_POPUP_CLOSED_EVENT, { detail: { reason } }));

    if (reason === "subscribed") {
      window.localStorage.setItem(buildConvertedKey(runtime.store.slug), "true");
      window.localStorage.removeItem(buildDismissKey(runtime.store.slug, config.campaignKey));
      return;
    }

    const dismissUntil = Date.now() + config.dismissDays * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(buildDismissKey(runtime.store.slug, config.campaignKey), String(dismissUntil));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (studioEnabled) {
      return;
    }

    setPending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const location = typeof window === "undefined" ? pathname ?? "" : `${window.location.pathname}${window.location.search}`;
      const response = await fetch(`/api/storefront/newsletter?store=${encodeURIComponent(runtime.store.slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-store-slug": runtime.store.slug },
        body: JSON.stringify({
          email,
          storeSlug: runtime.store.slug,
          source: STOREFRONT_WELCOME_POPUP_SOURCE,
          location,
          welcomePopupPromotionId: config.promotionId,
          welcomePopupCampaignKey: config.campaignKey
        })
      });
      const payload = (await response.json().catch(() => ({}))) as SubscribeResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to sign up right now.");
      }

      setSuccessMessage(
        payload.alreadySubscribed
          ? "You're already on the list. Watch your inbox for future store updates."
          : "Thanks. Your welcome discount code is on the way to your inbox."
      );
      dismiss("subscribed");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign up right now.");
    } finally {
      setPending(false);
    }
  }

  if (!open || !canShowOnSurface || (!studioEnabled && !config.enabled)) {
    return null;
  }

  function patchStudioSettings(
    patch: Partial<{
      welcome_popup_eyebrow: string | null;
      welcome_popup_headline: string | null;
      welcome_popup_body: string | null;
      welcome_popup_email_placeholder: string | null;
      welcome_popup_cta_label: string | null;
      welcome_popup_decline_label: string | null;
    }>
  ) {
    if (!studioDocument) {
      return;
    }

    studioDocument.setSettingsDraft((current) => ({
      ...ensureStorefrontSettingsDraft(current),
      ...patch
    }));
  }

  return (
    <div
      className={cn(
        "z-[85]",
        studioEnabled ? "absolute inset-0 overflow-y-auto" : "fixed inset-0"
      )}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className={cn(
          "relative z-[1] flex min-h-full justify-center px-4 py-6",
          studioEnabled ? "items-center" : "items-end sm:items-center"
        )}
      >
        <div
          className={cn(
            "relative w-full max-w-xl overflow-hidden border border-border/70 bg-background shadow-[0_32px_90px_rgba(15,23,42,0.3)] [font-family:var(--storefront-font-body)]",
            radiusClass
          )}
        >
          <div className={cn("grid gap-0", hasImageSlot && config.imageLayout === "left" ? "grid-cols-[0.9fr_1.1fr]" : "grid-cols-1")}>
            {config.imagePath ? (
              <div className="relative min-h-[14rem] bg-muted/20">
                {studioEnabled ? (
                  <StorefrontStudioEditableWelcomePopupImage imageUrl={config.imagePath} />
                ) : (
                  <Image src={config.imagePath} alt="" fill unoptimized className="object-cover" />
                )}
              </div>
            ) : studioEnabled ? (
              <div className="relative min-h-[14rem] bg-muted/20">
                <StorefrontStudioEditableWelcomePopupImage imageUrl={null} />
              </div>
            ) : null}

            <div className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={config.eyebrow}
                    placeholder="Welcome offer"
                    displayClassName="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground [font-family:var(--storefront-font-heading)]"
                    editorClassName="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground [font-family:var(--storefront-font-heading)]"
                    onChange={(value) => patchStudioSettings({ welcome_popup_eyebrow: value })}
                  />
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground [font-family:var(--storefront-font-heading)]">
                    {config.eyebrow}
                  </p>
                )}
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="h2"
                    value={config.headline}
                    placeholder="Enjoy a welcome offer"
                    displayClassName="text-2xl font-semibold tracking-tight text-foreground [font-family:var(--storefront-font-heading)]"
                    editorClassName="text-base [font-family:var(--storefront-font-heading)]"
                    onChange={(value) => patchStudioSettings({ welcome_popup_headline: value })}
                  />
                ) : (
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground [font-family:var(--storefront-font-heading)]">
                    {config.headline}
                  </h2>
                )}
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={config.body}
                    placeholder="Join the email list to get your welcome discount code sent straight to your inbox."
                    wrapperClassName="w-full"
                    displayClassName="text-sm leading-6 text-muted-foreground"
                    editorClassName="w-full text-sm leading-6"
                    onChange={(value) => patchStudioSettings({ welcome_popup_body: value })}
                  />
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">{config.body}</p>
                )}
              </div>

              <form className="space-y-3" onSubmit={handleSubmit}>
                {studioEnabled ? (
                  <StorefrontStudioEditableInputPlaceholder
                    value=""
                    onValueChange={() => undefined}
                    placeholder={config.emailPlaceholder}
                    onPlaceholderChange={(value) => patchStudioSettings({ welcome_popup_email_placeholder: value })}
                    inputClassName={buttonRadiusClass}
                  />
                ) : (
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={config.emailPlaceholder}
                    required
                    autoComplete="email"
                    className={buttonRadiusClass}
                  />
                )}
                {studioEnabled ? (
                  <div
                    data-studio-ignore-navigation="true"
                    className={cn(
                      "flex h-11 w-full items-center justify-center border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm",
                      buttonRadiusClass
                    )}
                  >
                    <StorefrontStudioEditableText
                      value={config.ctaLabel}
                      placeholder="Email my discount"
                      displayClassName="inline-flex items-center justify-center text-sm font-medium text-primary-foreground"
                      editorClassName="border-0 bg-transparent text-sm font-medium text-primary-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      onChange={(value) => patchStudioSettings({ welcome_popup_cta_label: value })}
                    />
                  </div>
                ) : (
                  <button type="submit" className={cn(buttonVariants(), "h-11 w-full", buttonRadiusClass)} disabled={pending}>
                    {pending ? "Sending..." : config.ctaLabel}
                  </button>
                )}

                {studioEnabled ? (
                  <div
                    data-studio-ignore-navigation="true"
                    className="flex w-full items-center justify-center pt-1 text-sm"
                  >
                    <StorefrontStudioEditableText
                      value={config.declineLabel}
                      placeholder="Decline offer"
                      displayClassName="inline-flex items-center justify-center text-sm font-medium text-muted-foreground underline underline-offset-4"
                      editorClassName="text-sm font-medium text-muted-foreground"
                      onChange={(value) => patchStudioSettings({ welcome_popup_decline_label: value })}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full pt-1 text-sm font-medium text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
                    disabled={pending}
                    onClick={() => dismiss("close")}
                  >
                    {config.declineLabel}
                  </button>
                )}
              </form>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {successMessage ? <p className="text-sm text-foreground">{successMessage}</p> : null}

              <p className="text-xs leading-5 text-muted-foreground">
                {`By joining, you agree to receive marketing emails from ${runtime.store.name}. Unsubscribe anytime from any email.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
