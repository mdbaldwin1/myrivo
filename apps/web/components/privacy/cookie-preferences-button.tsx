"use client";

import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useCookieConsent } from "@/components/privacy/cookie-consent-provider";

type CookiePreferencesButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function CookiePreferencesButton({ className, children, ...props }: CookiePreferencesButtonProps) {
  const { openPreferences } = useCookieConsent();

  return (
    <button
      type="button"
      className={cn("text-sm hover:text-foreground", className)}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          openPreferences();
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
