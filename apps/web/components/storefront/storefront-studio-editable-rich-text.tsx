"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type StorefrontStudioEditableRichTextProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wrapperClassName?: string;
  displayClassName?: string;
  editorClassName?: string;
  buttonClassName?: string;
};

export function StorefrontStudioEditableRichText({
  value,
  onChange,
  placeholder,
  wrapperClassName,
  displayClassName,
  editorClassName,
  buttonClassName
}: StorefrontStudioEditableRichTextProps) {
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sanitizedValue = sanitizeRichTextHtml(value);

  useEffect(() => {
    if (!editing) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditing(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current) {
        return;
      }

      if (event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
        setEditing(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [editing]);

  function startEditing(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setEditing(true);
  }

  return (
    <div ref={wrapperRef} data-studio-ignore-navigation="true" className={cn("group/editable relative w-full max-w-full", wrapperClassName)}>
      <button
        type="button"
        aria-label="Edit content"
        className={cn(
          "absolute -right-2 -top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-900/10 bg-white/95 text-slate-700 shadow-sm opacity-0 transition group-hover/editable:opacity-100 group-focus-within/editable:opacity-100 hover:bg-white sm:h-8 sm:w-8",
          buttonClassName
        )}
        onClick={startEditing}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {editing ? (
        <div className={cn("rounded-2xl border border-slate-300 bg-white/95 p-3 shadow-sm", editorClassName)}>
          <RichTextEditor value={value} onChange={onChange} placeholder={placeholder} rows={10} imageUpload={{ folder: "storefront-studio" }} />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
              onClick={() => setEditing(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : sanitizedValue ? (
        <article
          data-rich-text-content="true"
          className={displayClassName}
          dangerouslySetInnerHTML={{ __html: sanitizedValue }}
        />
      ) : (
        <div className={cn("rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-5 text-sm text-muted-foreground", displayClassName)}>
          {placeholder ?? "Add content"}
        </div>
      )}
    </div>
  );
}
