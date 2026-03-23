"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type ConfirmDialogRequest = {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
};

export function useConfirmDialog() {
  const [dialogRequest, setDialogRequest] = useState<ConfirmDialogRequest | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  function resolveDialog(confirmed: boolean) {
    setDialogRequest(null);
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }

  function requestConfirm(request: ConfirmDialogRequest) {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setDialogRequest(request);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }

  const confirmDialog = dialogRequest ? (
    <ConfirmDialog
      open
      title={dialogRequest.title}
      description={dialogRequest.description}
      confirmLabel={dialogRequest.confirmLabel}
      cancelLabel={dialogRequest.cancelLabel}
      confirmVariant={dialogRequest.confirmVariant}
      onCancel={() => resolveDialog(false)}
      onConfirm={() => resolveDialog(true)}
    />
  ) : null;

  return { requestConfirm, confirmDialog };
}
