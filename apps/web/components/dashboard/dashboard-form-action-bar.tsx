"use client";

import type { ReactNode } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardFormActionBarProps = {
  formId: string;
  className?: string;
  saveLabel?: string;
  savePendingLabel?: string;
  savePending?: boolean;
  discardLabel?: string;
  saveDisabled?: boolean;
  discardDisabled?: boolean;
  statusMessage?: string | null;
  statusVariant?: "error" | "warning" | "info";
  actions?: ReactNode;
};

export function DashboardFormActionBar({
  formId,
  className,
  saveLabel = "Save",
  savePendingLabel,
  savePending = false,
  discardLabel = "Discard",
  saveDisabled = false,
  discardDisabled = false,
  statusMessage = null,
  statusVariant = "error",
  actions
}: DashboardFormActionBarProps) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-border/70 bg-white px-4 py-3 lg:px-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-h-6 flex-1">
          <AppAlert compact variant={statusVariant} message={statusMessage} className="text-sm" />
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button type="submit" form={formId} name="intent" value="discard" variant="outline" disabled={discardDisabled}>
            {discardLabel}
          </Button>
          <Button type="submit" form={formId} name="intent" value="save" disabled={saveDisabled}>
            {savePending && savePendingLabel ? savePendingLabel : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
