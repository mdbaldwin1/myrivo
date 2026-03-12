"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StorefrontStudioEditableButtonLabelProps = {
  label: string;
  placeholder: string;
  wrapperClassName?: string;
  labelClassName?: string;
  panelClassName?: string;
  allowPointerThrough?: boolean;
  onChange: (nextLabel: string) => void;
};

export function StorefrontStudioEditableButtonLabel({
  label,
  placeholder,
  wrapperClassName,
  labelClassName,
  panelClassName,
  allowPointerThrough = false,
  onChange
}: StorefrontStudioEditableButtonLabelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-studio-ignore-navigation="true"
      className={cn("group/cta relative inline-flex max-w-full", allowPointerThrough && "pointer-events-none", wrapperClassName)}
    >
      <span className={cn(labelClassName, allowPointerThrough && "pointer-events-none")}>{label.trim() || placeholder}</span>

      <Button
        type="button"
        size="icon"
        variant="secondary"
        className={cn(
          "absolute -right-2 -top-2 z-20 h-7 w-7 rounded-full border border-border/70 bg-white/95 opacity-0 shadow-sm transition group-hover/cta:opacity-100 sm:h-8 sm:w-8",
          allowPointerThrough && "pointer-events-auto"
        )}
        aria-label="Edit button label"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute left-1/2 top-full z-30 mt-2 w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-border/70 bg-white p-3 shadow-xl sm:left-0 sm:w-[18rem] sm:translate-x-0",
            allowPointerThrough && "pointer-events-auto",
            panelClassName
          )}
        >
          <div className="space-y-3">
            <FormField label="Button label">
              <Input value={label} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
            </FormField>
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
