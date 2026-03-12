"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StorefrontStudioEditableLinkProps = {
  label: string;
  url: string;
  labelPlaceholder: string;
  urlPlaceholder: string;
  emptyLabel: string;
  hideUrlField?: boolean;
  allowNavigation?: boolean;
  wrapperClassName?: string;
  displayClassName?: string;
  placeholderClassName?: string;
  buttonClassName?: string;
  panelClassName?: string;
  onChange: (next: { label: string; url: string }) => void;
};

export function StorefrontStudioEditableLink({
  label,
  url,
  labelPlaceholder,
  urlPlaceholder,
  emptyLabel,
  hideUrlField = false,
  allowNavigation = false,
  wrapperClassName,
  displayClassName,
  placeholderClassName,
  buttonClassName,
  panelClassName,
  onChange
}: StorefrontStudioEditableLinkProps) {
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

  const hasValue = label.trim().length > 0 || url.trim().length > 0;
  const resolvedLabel = label.trim() || emptyLabel;

  return (
    <div
      ref={rootRef}
      data-studio-ignore-navigation={allowNavigation ? undefined : "true"}
      className={cn("group/cta relative inline-flex max-w-full", wrapperClassName)}
    >
      {url.trim().length > 0 ? (
        <Link href={url} className={cn(displayClassName, buttonClassName)}>
          {resolvedLabel}
        </Link>
      ) : (
        <span className={cn(displayClassName, hasValue ? buttonClassName : placeholderClassName ?? buttonClassName)}>{resolvedLabel}</span>
      )}

      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute -right-2 -top-2 z-20 h-7 w-7 rounded-full border border-border/70 bg-white/95 opacity-0 shadow-sm transition group-hover/cta:opacity-100 sm:h-8 sm:w-8"
        aria-label="Edit call to action"
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
          data-studio-ignore-navigation="true"
          className={cn(
            "absolute left-1/2 top-full z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-border/70 bg-white p-3 shadow-xl sm:left-0 sm:w-[20rem] sm:translate-x-0",
            panelClassName
          )}
        >
          <div className="space-y-3">
            <FormField label="Label">
              <Input value={label} placeholder={labelPlaceholder} onChange={(event) => onChange({ label: event.target.value, url })} />
            </FormField>
            {hideUrlField ? null : (
              <FormField label="URL">
                <Input value={url} placeholder={urlPlaceholder} onChange={(event) => onChange({ label, url: event.target.value })} />
              </FormField>
            )}
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
