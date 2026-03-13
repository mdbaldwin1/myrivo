"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMarketingAnalytics } from "@/components/marketing/marketing-analytics-provider";

type ButtonVariant = NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];
type ButtonSize = NonNullable<Parameters<typeof buttonVariants>[0]>["size"];

type MarketingTrackedButtonLinkProps = {
  href: string;
  ctaKey: string;
  ctaLabel: string;
  sectionKey?: string;
  conversionIntent?: "signup" | "demo_request";
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

function appendMarketingSource(href: string, source: Record<string, string>) {
  if (!href.startsWith("/signup")) {
    return href;
  }

  const [pathname, rawQuery] = href.split("?", 2);
  const params = new URLSearchParams(rawQuery ?? "");
  for (const [key, value] of Object.entries(source)) {
    params.set(key, value);
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function MarketingTrackedButtonLink({
  href,
  ctaKey,
  ctaLabel,
  sectionKey,
  conversionIntent,
  variant = "default",
  size,
  className,
  children
}: MarketingTrackedButtonLinkProps) {
  const { pageKey, track } = useMarketingAnalytics();
  const trackedHref = appendMarketingSource(href, {
    source: ctaKey,
    marketingPage: pageKey ?? "unknown",
    marketingSection: sectionKey ?? "unknown",
    marketingCta: ctaKey,
    marketingLabel: ctaLabel
  });

  const handleClick = () => {
    track({
      eventType: "cta_click",
      sectionKey,
      ctaKey,
      ctaLabel,
      value: {
        destination: href,
        surface: "marketing_site"
      }
    });

    if (conversionIntent === "signup") {
      track({
        eventType: "signup_started",
        sectionKey,
        ctaKey,
        ctaLabel,
        value: {
          source: ctaKey
        }
      });
    }

    if (conversionIntent === "demo_request") {
      track({
        eventType: "demo_request_started",
        sectionKey,
        ctaKey,
        ctaLabel,
        value: {
          channel: href.startsWith("mailto:") ? "email" : "form"
        }
      });
    }
  };

  if (href.startsWith("mailto:") || href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <Button asChild variant={variant} size={size} className={cn(className)}>
        <a href={trackedHref} onClick={handleClick}>
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} size={size} className={cn(className)}>
      <Link href={trackedHref} onClick={handleClick}>
        {children}
      </Link>
    </Button>
  );
}
