"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StorefrontStudioEditableTemplateTextProps = {
  renderedValue: string;
  templateValue: string;
  placeholder: string;
  fieldLabel: string;
  helperTitle?: string;
  helperTokens?: string[];
  helperExample?: string;
  displayClassName?: string;
  wrapperClassName?: string;
  panelClassName?: string;
  onChange: (nextTemplate: string) => void;
};

export function StorefrontStudioEditableTemplateText({
  renderedValue,
  templateValue,
  placeholder,
  fieldLabel,
  helperTitle = "Available variables",
  helperTokens = [],
  helperExample,
  displayClassName,
  wrapperClassName,
  panelClassName,
  onChange
}: StorefrontStudioEditableTemplateTextProps) {
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
    <div ref={rootRef} data-studio-ignore-navigation="true" className={cn("group/template relative inline-flex max-w-full", wrapperClassName)}>
      <p className={displayClassName}>{renderedValue || placeholder}</p>

      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute -right-2 -top-2 z-20 h-7 w-7 rounded-full border border-border/70 bg-white/95 opacity-0 shadow-sm transition group-hover/template:opacity-100 group-focus-within/template:opacity-100 sm:h-8 sm:w-8"
        aria-label={`Edit ${fieldLabel.toLowerCase()}`}
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
            "absolute left-1/2 top-full z-30 mt-2 w-[min(22rem,calc(100vw-1.5rem))] max-w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-border/70 bg-white p-3 shadow-xl sm:left-0 sm:max-w-[min(22rem,calc(100vw-2rem))] sm:translate-x-0",
            panelClassName
          )}
        >
          <div className="space-y-3">
            <FormField label={fieldLabel}>
              <Input value={templateValue} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
            </FormField>
            {helperTokens.length > 0 || helperExample ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {helperTokens.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{helperTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      {helperTokens.map((token) => (
                        <code key={token} className="rounded bg-white px-2 py-1 text-xs text-slate-700">
                          {token}
                        </code>
                      ))}
                    </div>
                  </div>
                ) : null}
                {helperExample ? <p className="text-xs text-muted-foreground">{helperExample}</p> : null}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
