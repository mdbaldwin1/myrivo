"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StorefrontStudioStorefrontEditorPanelTabContainerProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function StorefrontStudioStorefrontEditorPanelTabContainer({
  children,
  footer,
  className
}: StorefrontStudioStorefrontEditorPanelTabContainerProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {children}
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
