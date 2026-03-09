"use client";

import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const appAlertVariants = cva("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", {
  variants: {
    variant: {
      error: "border-red-200 bg-red-50 text-red-700",
      success: "border-emerald-200 bg-emerald-50 text-emerald-800",
      warning: "border-amber-200 bg-amber-50 text-amber-800",
      info: "border-border bg-muted/30 text-foreground"
    },
    compact: {
      true: "border-0 bg-transparent px-0 py-0",
      false: ""
    }
  },
  defaultVariants: {
    variant: "info",
    compact: false
  }
});

type AppAlertProps = VariantProps<typeof appAlertVariants> & {
  title?: string;
  message: string | null;
  className?: string;
  action?: ReactNode;
};

function IconForVariant({ variant }: { variant: NonNullable<AppAlertProps["variant"]> }) {
  if (variant === "error") {
    return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  if (variant === "success") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  if (variant === "warning") {
    return <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  return <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />;
}

export function AppAlert({ variant = "info", compact = false, title, message, className, action }: AppAlertProps) {
  if (!message) {
    return null;
  }

  const resolvedVariant: NonNullable<AppAlertProps["variant"]> = variant ?? "info";

  return (
    <div role="status" aria-live="polite" className={cn(appAlertVariants({ variant: resolvedVariant, compact }), className)}>
      <IconForVariant variant={resolvedVariant} />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <p>{message}</p>
        {action}
      </div>
    </div>
  );
}
