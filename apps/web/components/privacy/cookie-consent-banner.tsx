"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/privacy/cookie-consent-provider";
import { cn } from "@/lib/utils";
import { useStorefrontCookieTheme } from "@/components/privacy/use-storefront-cookie-theme";

type CookieConsentBannerProps = {
  onOpenPreferences: () => void;
};

export function CookieConsentBanner({ onOpenPreferences }: CookieConsentBannerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { acceptAll, acceptEssentialOnly, globalPrivacyControlEnabled } = useCookieConsent();
  const [isSubmitting, setIsSubmitting] = useState<"analytics" | "essential" | null>(null);
  const {
    isStorefront,
    cookiePolicyHref,
    themeStyle,
    radiusClass,
    buttonRadiusClass,
    cardClass,
    pageWidthClass,
    bannerPaddingClass
  } =
    useStorefrontCookieTheme();

  const activeStoreCookiePolicyHref = (() => {
    const queryStore = searchParams?.get("store")?.trim();
    if (queryStore) {
      return `/cookies?store=${encodeURIComponent(queryStore)}`;
    }

    const storefrontMatch = pathname?.match(/^\/s\/([^/]+)/);
    if (storefrontMatch?.[1]) {
      return `/s/${encodeURIComponent(storefrontMatch[1])}/cookies`;
    }

    return cookiePolicyHref;
  })();
  const nextSearch = searchParams?.toString();
  const customizeHref = `${nextSearch ? `${pathname ?? "/"}?${nextSearch}` : pathname ?? "/"}#cookie-preferences`;

  return (
    <div
      data-cookie-banner="true"
      style={themeStyle}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[75] border-t border-border/70 bg-background/95 backdrop-blur",
        isStorefront && "bg-[color:var(--storefront-bg)]/95 text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
      )}
    >
      <div className={cn("mx-auto w-full", pageWidthClass, "px-4 pb-4 pt-3 sm:px-6", isStorefront && "lg:px-0")}>
        <div
          data-cookie-banner-card="true"
          className={cn(
            "flex flex-col gap-4",
            isStorefront ? "lg:flex-row lg:items-center lg:justify-between" : "lg:flex-row lg:items-center lg:justify-between",
            isStorefront && "border border-border/70 bg-[color:var(--storefront-surface)]/88 shadow-sm",
            radiusClass,
            cardClass,
            bannerPaddingClass
          )}
        >
        <div className={cn("space-y-1", isStorefront && "max-w-3xl")}>
          <p
            className={cn(
              "text-sm font-semibold text-foreground",
              isStorefront && "[font-family:var(--storefront-font-heading)] text-base"
            )}
          >
            We use cookies and similar technologies
          </p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Essential cookies keep Myrivo and storefronts working. Optional analytics cookies help stores understand traffic and conversion performance.{" "}
            <Link href={activeStoreCookiePolicyHref} className="font-medium text-foreground underline underline-offset-4">
              Learn more in our Cookie Policy
            </Link>
            .
          </p>
          {globalPrivacyControlEnabled ? (
            <p className="max-w-3xl text-sm leading-relaxed text-foreground/80">
              Your browser is sending a Global Privacy Control signal, so optional analytics cookies will stay off on this device.
            </p>
          ) : null}
        </div>
          <div className={cn("flex flex-col gap-2 sm:min-w-fit sm:items-end sm:shrink-0", isStorefront && "lg:min-w-fit")}>
            <div className="flex flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className={cn("min-w-[10rem]", buttonRadiusClass)}
                disabled={isSubmitting !== null}
                onClick={async () => {
                  setIsSubmitting("essential");
                  try {
                    await acceptEssentialOnly();
                  } finally {
                    setIsSubmitting(null);
                  }
                }}
              >
                {isSubmitting === "essential" ? "Saving..." : "Essential only"}
              </Button>
              <Button
                type="button"
                className={cn("min-w-[10rem]", buttonRadiusClass)}
                disabled={isSubmitting !== null || globalPrivacyControlEnabled}
                onClick={async () => {
                  setIsSubmitting("analytics");
                  try {
                    await acceptAll();
                  } finally {
                    setIsSubmitting(null);
                  }
                }}
              >
                {globalPrivacyControlEnabled ? "Browser signal active" : isSubmitting === "analytics" ? "Saving..." : "Accept all"}
              </Button>
            </div>
            <Link
              href={customizeHref}
              onClick={(event) => {
                event.preventDefault();
                onOpenPreferences();
              }}
              className="inline-flex items-center justify-end text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Customize
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
