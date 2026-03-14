"use client";

import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";
import { useRef } from "react";

type BrandingAssetPickerProps = {
  accept: string;
  previewSrc: string | null;
  previewAlt: string;
  emptyAriaLabel: string;
  replaceAriaLabel: string;
  removeAriaLabel: string;
  helperText: string;
  previewPaddingClassName?: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
};

export function BrandingAssetPicker({
  accept,
  previewSrc,
  previewAlt,
  emptyAriaLabel,
  replaceAriaLabel,
  removeAriaLabel,
  helperText,
  previewPaddingClassName = "p-2",
  onFileSelect,
  onRemove
}: BrandingAssetPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) {
            return;
          }
          onFileSelect(file);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        {previewSrc ? (
          <div
            className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15 transition-transform hover:scale-[1.02]"
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            aria-label={replaceAriaLabel}
          >
            <Image src={previewSrc} alt={previewAlt} fill unoptimized className={`object-contain bg-white ${previewPaddingClassName}`} />
            <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
            </div>
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              aria-label={removeAriaLabel}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
            onClick={() => inputRef.current?.click()}
            aria-label={emptyAriaLabel}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
