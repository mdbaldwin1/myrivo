"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

/**
 * A storefront image at a size worth looking at.
 *
 * Merchants check what a buyer will actually see - crops, watermarks, whether
 * the right picture is featured - and a 96px tile cannot answer that.
 */
export function ImageViewerDialog({
  imageUrl,
  title,
  onClose,
}: {
  /** The image on show, or null when the viewer is closed. */
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={Boolean(imageUrl)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Above the editor sheet (z-[80]/[81]); below it the sheet's own
            backdrop covers this and swallows every click on it. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[90vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="text-sm font-medium">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" aria-label="Close image">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            The full-size storefront image.
          </DialogPrimitive.Description>
          {imageUrl ? (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-muted/20">
              <Image
                src={imageUrl}
                alt={title}
                width={1600}
                height={1600}
                unoptimized
                className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
