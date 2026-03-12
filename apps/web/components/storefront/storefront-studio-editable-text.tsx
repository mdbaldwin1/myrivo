"use client";

import { Pencil } from "lucide-react";
import { createElement, useEffect, useRef, useState, type ElementType, type MouseEvent, type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type StorefrontStudioEditableTextProps = {
  value: string;
  onChange: (value: string) => void;
  as?: ElementType;
  multiline?: boolean;
  placeholder?: string;
  wrapperClassName?: string;
  displayClassName?: string;
  editorClassName?: string;
  buttonClassName?: string;
};

export function StorefrontStudioEditableText({
  value,
  onChange,
  as = "div",
  multiline = false,
  placeholder,
  wrapperClassName,
  displayClassName,
  editorClassName,
  buttonClassName
}: StorefrontStudioEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }

    editorRef.current?.focus();
    editorRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current) {
        return;
      }

      if (event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
        setEditing(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [editing]);

  function startEditing(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setEditing(true);
  }

  return (
    <div ref={wrapperRef} data-studio-ignore-navigation="true" className={cn("group/editable relative w-fit max-w-full", wrapperClassName)}>
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
        multiline ? (
          <Textarea
            ref={editorRef as RefObject<HTMLTextAreaElement>}
            rows={4}
            value={value}
            placeholder={placeholder}
            className={cn("min-h-[7rem] w-[min(100%,28rem)] max-w-[calc(100vw-1.5rem)] bg-white/95 shadow-sm sm:max-w-[calc(100vw-2rem)]", editorClassName)}
            onChange={(event) => onChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => setEditing(false)}
          />
        ) : (
          <Input
            ref={editorRef as RefObject<HTMLInputElement>}
            value={value}
            placeholder={placeholder}
            className={cn("h-auto min-h-[2.75rem] w-[min(100%,24rem)] max-w-[calc(100vw-1.5rem)] bg-white/95 shadow-sm sm:max-w-[calc(100vw-2rem)]", editorClassName)}
            onChange={(event) => onChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setEditing(false);
              }
            }}
          />
        )
      ) : (
        createElement(as, { className: displayClassName }, value || placeholder || "")
      )}
    </div>
  );
}
