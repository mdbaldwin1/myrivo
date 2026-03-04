"use client";

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
  reserveSpace?: boolean;
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
  reserveSpace = true
}: DashboardFormActionBarProps) {
  return (
    <>
      {reserveSpace ? <div aria-hidden className="h-24" /> : null}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(15,23,42,0.06)] supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur lg:left-72 lg:px-6",
          className
        )}
      >
        <div className="flex items-center justify-end gap-2">
          <Button type="submit" form={formId} name="intent" value="discard" variant="outline" disabled={discardDisabled}>
            {discardLabel}
          </Button>
          <Button type="submit" form={formId} name="intent" value="save" disabled={saveDisabled}>
            {savePending && savePendingLabel ? savePendingLabel : saveLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
