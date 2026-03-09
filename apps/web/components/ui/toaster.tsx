"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "shadow-md",
          title: "text-sm font-medium",
          description: "text-xs"
        }
      }}
    />
  );
}
