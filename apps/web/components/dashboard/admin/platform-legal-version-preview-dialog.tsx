"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { Button } from "@/components/ui/button";

type PlatformLegalVersionPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  contentMarkdown: string;
};

export function PlatformLegalVersionPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  contentMarkdown
}: PlatformLegalVersionPreviewDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content className="fixed inset-3 z-[81] overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] data-[state=open]:animate-in data-[state=closed]:animate-out">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              aria-label="Close legal version preview"
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/95 text-foreground shadow-sm backdrop-blur transition hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogPrimitive.Close>
          <div className="h-full overflow-y-auto p-6 sm:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="space-y-2 border-b border-border/60 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Admin preview</p>
                <h2 className="text-3xl font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <LegalMarkdown content={contentMarkdown.trim() || "This legal version has no content yet."} />
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
