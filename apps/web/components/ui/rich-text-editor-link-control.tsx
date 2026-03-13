"use client";

import type { Editor } from "@tiptap/react";
import { Link as LinkIcon, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RichTextEditorLinkControlProps = {
  editor: Editor;
  disabled?: boolean;
  buttonClassName?: string;
};

export function RichTextEditorLinkControl({
  editor,
  disabled = false,
  buttonClassName
}: RichTextEditorLinkControlProps) {
  const [open, setOpen] = useState(false);
  const [hrefDraft, setHrefDraft] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [editor, open]);

  function applyLink() {
    const trimmedHref = hrefDraft.trim();

    if (!trimmedHref) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmedHref }).run();
    setOpen(false);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setHrefDraft("");
    setOpen(false);
  }

  function toggleOpen() {
    if (!open) {
      setHrefDraft(String(editor.getAttributes("link").href ?? ""));
    }

    setOpen((current) => !current);
  }

  return (
    <div ref={rootRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={editor.isActive("link") ? "secondary" : "ghost"}
            size="icon"
            className={buttonClassName}
            aria-label="Link"
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={toggleOpen}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Link</TooltipContent>
      </Tooltip>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-border/70 bg-background p-3 shadow-xl"
          )}
        >
          <div className="space-y-3">
            <FormField label="Link URL" description="Paste a full URL or remove the link entirely.">
              <Input
                ref={inputRef}
                value={hrefDraft}
                placeholder="https://example.com"
                onChange={(event) => setHrefDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
              />
            </FormField>

            <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={removeLink}>
                <Trash2 className="h-4 w-4" />
                Remove link
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={applyLink}>
                  Apply link
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
