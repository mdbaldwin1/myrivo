"use client";

import { Pencil, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StorefrontStudioEditableInputPlaceholderProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  onPlaceholderChange: (value: string) => void;
  inputClassName?: string;
  panelClassName?: string;
};

export function StorefrontStudioEditableInputPlaceholder({
  value,
  onValueChange,
  placeholder,
  onPlaceholderChange,
  inputClassName,
  panelClassName
}: StorefrontStudioEditableInputPlaceholderProps) {
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
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} data-studio-ignore-navigation="true" className="group/search-placeholder relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} className={cn("pl-9", inputClassName)} />
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute -right-2 -top-2 z-20 h-7 w-7 rounded-full border border-border/70 bg-white/95 opacity-0 shadow-sm transition group-hover/search-placeholder:opacity-100 group-focus-within/search-placeholder:opacity-100 sm:h-8 sm:w-8"
        aria-label="Edit search placeholder"
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
            "absolute left-1/2 top-full z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-border/70 bg-white p-3 shadow-xl sm:left-0 sm:max-w-[min(20rem,calc(100vw-2rem))] sm:translate-x-0",
            panelClassName
          )}
        >
          <div className="space-y-3">
            <FormField label="Search placeholder">
              <Input value={placeholder} placeholder="Search products..." onChange={(event) => onPlaceholderChange(event.target.value)} />
            </FormField>
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
