"use client";

import Link from "next/link";
import { ArrowUpRight, WandSparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StorefrontStudioHandoffPanelProps = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  note?: string;
};

export function StorefrontStudioHandoffPanel({
  title,
  description,
  href,
  ctaLabel,
  note
}: StorefrontStudioHandoffPanelProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          <WandSparkles className="h-3.5 w-3.5" />
          Storefront Studio
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {note ? <p className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">{note}</p> : null}

      <Link href={href} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}>
        {ctaLabel}
        <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
