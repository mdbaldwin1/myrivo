"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StorefrontStudioStorefrontEditorPanelTabSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  separated?: boolean;
};

export function StorefrontStudioStorefrontEditorPanelTabSection({
  title,
  description,
  children,
  className,
  separated = false
}: StorefrontStudioStorefrontEditorPanelTabSectionProps) {
  return (
    <section className={cn("space-y-3", separated && "border-t border-border/70 pt-4", className)}>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
