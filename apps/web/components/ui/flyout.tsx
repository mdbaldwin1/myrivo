"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type FlyoutFooterControls = {
  requestClose: () => void;
};

type FlyoutProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode | ((controls: FlyoutFooterControls) => ReactNode);
  className?: string;
  confirmDiscardOnClose?: boolean;
  isDirty?: boolean;
  onDiscardConfirm?: () => void;
  discardTitle?: ReactNode;
  discardDescription?: ReactNode;
  discardConfirmLabel?: string;
  discardCancelLabel?: string;
  inline?: boolean;
};

export function Flyout({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  confirmDiscardOnClose = false,
  isDirty = false,
  onDiscardConfirm,
  discardTitle = "Discard changes?",
  discardDescription = "Are you sure you want to discard your changes?",
  discardConfirmLabel = "Discard changes",
  discardCancelLabel = "Keep editing",
  inline = false
}: FlyoutProps) {
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  function requestClose() {
    if (confirmDiscardOnClose && isDirty) {
      setIsDiscardDialogOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleSheetOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  const footerNode =
    typeof footer === "function"
      ? footer({ requestClose })
      : footer ?? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={requestClose}>
              Close
            </Button>
          </div>
        );

  if (inline) {
    const hasHeader = Boolean(title) || Boolean(description);
    return (
      <div className={cn("space-y-4", className)}>
        {hasHeader ? (
          <div className="border-b border-border/60 pb-3">
            {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        ) : null}
        <div className="space-y-4">{children}</div>
        <div className="border-t border-border/60 pt-4">{footerNode}</div>
      </div>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className={cn("flex h-full w-full max-w-xl flex-col border-l border-border bg-white p-0", className)}>
          <SheetHeader className="mb-6 px-6 pt-6 pr-14 sm:px-8 sm:pt-8 sm:pr-16">
            <SheetTitle>{title ?? "Edit"}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 px-6 pb-4 sm:px-8 sm:pb-6">{children}</div>
          </div>
          <div className="border-t border-border px-6 pb-6 pt-4 sm:px-8 sm:pb-8">{footerNode}</div>
        </SheetContent>
      </Sheet>

      <DialogPrimitive.Root open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[61] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-6 shadow-lg">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{discardTitle}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">{discardDescription}</DialogPrimitive.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDiscardDialogOpen(false)}>
                {discardCancelLabel}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setIsDiscardDialogOpen(false);
                  onDiscardConfirm?.();
                  onOpenChange(false);
                }}
              >
                {discardConfirmLabel}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
