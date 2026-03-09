"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContextHelpLinkProps = {
  href: string;
  context: string;
  storeSlug?: string;
  label?: string;
  className?: string;
};

export function ContextHelpLink({ href, context, storeSlug, label = "Help", className }: ContextHelpLinkProps) {
  const pathname = usePathname();

  function trackHelpClick() {
    const body = JSON.stringify({
      context,
      targetHref: href,
      sourcePathname: pathname,
      storeSlug: storeSlug ?? null
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/help/track", blob);
      return;
    }

    void fetch("/api/help/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    });
  }

  return (
    <Link
      href={href}
      onClick={trackHelpClick}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1", className)}
    >
      <CircleHelp className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  );
}
