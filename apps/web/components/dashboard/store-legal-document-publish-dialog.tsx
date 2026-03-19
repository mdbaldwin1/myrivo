"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

type StoreLegalDocumentPublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentLabel: string;
  effectiveAt: string;
  changeSummary: string;
  publishPending: boolean;
  error: string | null;
  onEffectiveAtChange: (value: string) => void;
  onChangeSummaryChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
};

export function StoreLegalDocumentPublishDialog({
  open,
  onOpenChange,
  documentLabel,
  effectiveAt,
  changeSummary,
  publishPending,
  error,
  onEffectiveAtChange,
  onChangeSummaryChange,
  onConfirm
}: StoreLegalDocumentPublishDialogProps) {
  const publishDisabled = publishPending || changeSummary.trim().length < 8;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100vh-2rem)] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Publish {documentLabel}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            Add the effective date and a short publish summary before customers see this new version.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              aria-label="Close publish dialog"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogPrimitive.Close>

          <div className="mt-5 space-y-4">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <FormField label="Effective at" description="Optional. Leave blank to make this update effective immediately.">
              <DateTimePicker value={effectiveAt} onChange={onEffectiveAtChange} />
            </FormField>

            <FormField
              label="Publish summary"
              description="Required. Record what changed so this legal update remains explainable later."
            >
              <Textarea
                rows={4}
                value={changeSummary}
                onChange={(event) => onChangeSummaryChange(event.target.value)}
                placeholder="Example: Clarified refund language and updated privacy contact details."
              />
            </FormField>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={publishPending}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onConfirm()} disabled={publishDisabled}>
              {publishPending ? "Publishing..." : `Publish ${documentLabel}`}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
