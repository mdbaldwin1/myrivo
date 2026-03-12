"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StorefrontStudioCheckoutPreviewState = "return" | "cancelled" | "preparing" | "placed" | "failed";

const previewOptions: Array<{ value: StorefrontStudioCheckoutPreviewState; label: string }> = [
  { value: "return", label: "Return prompt" },
  { value: "cancelled", label: "Cancelled" },
  { value: "preparing", label: "Preparing" },
  { value: "placed", label: "Order placed" },
  { value: "failed", label: "Failed" }
];

type StorefrontStudioCheckoutPreviewStatePickerProps = {
  value: StorefrontStudioCheckoutPreviewState;
  onValueChange: (value: StorefrontStudioCheckoutPreviewState) => void;
  className?: string;
};

export function StorefrontStudioCheckoutPreviewStatePicker({
  value,
  onValueChange,
  className
}: StorefrontStudioCheckoutPreviewStatePickerProps) {
  return (
    <div
      data-studio-ignore-navigation="true"
      className={cn("rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur", className)}
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview state</p>
        <div className="flex flex-wrap gap-2">
          {previewOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={option.value === value ? "default" : "outline"}
              className={cn("h-8 rounded-full px-3 text-xs", option.value === value ? "shadow-sm" : "bg-white")}
              onClick={() => onValueChange(option.value)}
              aria-pressed={option.value === value}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
