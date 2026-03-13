"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type CookieConsentBannerProps = {
  storefrontStyled: boolean;
  buttonRadiusClass: string;
  surfaceRadiusClass: string;
  onAcceptAll: () => void;
  onAcceptEssentialOnly: () => void;
  onOpenPreferences: () => void;
};

export function CookieConsentBanner({
  storefrontStyled,
  buttonRadiusClass,
  surfaceRadiusClass,
  onAcceptAll,
  onAcceptEssentialOnly,
  onOpenPreferences
}: CookieConsentBannerProps) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[75] border-t border-border/70 bg-background/95 backdrop-blur ${
        storefrontStyled ? "[font-family:var(--storefront-font-body)] text-[color:var(--storefront-text)]" : ""
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between ${
          storefrontStyled ? `${surfaceRadiusClass} lg:my-3 lg:border lg:border-border/60 lg:bg-card/80 lg:px-6` : ""
        }`}
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">We use cookies and similar technologies</p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Essential cookies keep Myrivo and storefronts working. Optional analytics cookies stay off unless you turn them on, and help stores understand traffic and conversion performance.{" "}
            <Link href="/cookies" className="font-medium text-foreground underline underline-offset-4">
              Learn more in our Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" className={`min-w-[10rem] ${buttonRadiusClass}`} onClick={onOpenPreferences}>
            Customize
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`min-w-[10rem] ${buttonRadiusClass}`}
            onClick={onAcceptEssentialOnly}
          >
            Essential only
          </Button>
          <Button type="button" className={`min-w-[10rem] ${buttonRadiusClass}`} onClick={onAcceptAll}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
