"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  title: string;
  description: string;
  className?: string;
  action?: ReactNode;
};

export function DashboardPageHeader({ title, description, className, action }: DashboardPageHeaderProps) {
  return (
    <header
      className={cn(
        "rounded-md border border-border/70 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
