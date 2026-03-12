"use client";

import type { ReactNode } from "react";
import { Layers3 } from "lucide-react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import type { StorefrontStudioSelection } from "@/lib/storefront/studio-structure";
import { cn } from "@/lib/utils";

type StorefrontStudioSelectableRegionProps = {
  selection: NonNullable<StorefrontStudioSelection>;
  label: string;
  className?: string;
  accessory?: ReactNode;
  children: ReactNode;
};

function selectionsMatch(left: StorefrontStudioSelection, right: NonNullable<StorefrontStudioSelection>) {
  return Boolean(left && left.kind === right.kind && left.id === right.id);
}

export function StorefrontStudioSelectableRegion({
  selection,
  label,
  className,
  accessory,
  children
}: StorefrontStudioSelectableRegionProps) {
  const document = useOptionalStorefrontStudioDocument();
  const isSelected = selectionsMatch(document?.selection ?? null, selection);

  if (!document) {
    return <>{children}</>;
  }

  return (
    <div
      data-studio-selection-kind={selection.kind}
      data-studio-selection-id={selection.id}
      className={cn(
        "group/selection relative rounded-xl transition",
        isSelected ? "ring-2 ring-primary/45 ring-offset-2 ring-offset-white" : "hover:ring-2 hover:ring-primary/20 hover:ring-offset-2 hover:ring-offset-white",
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        document.setSelection(selection);
      }}
    >
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-0 z-20 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-slate-900/10 bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm transition",
          isSelected ? "opacity-100" : "opacity-0 group-hover/selection:opacity-100"
        )}
      >
        <Layers3 className="h-3 w-3" />
        {label}
      </div>
      {accessory ? <div className="absolute right-2 top-0 z-30 -translate-y-1/2">{accessory}</div> : null}
      {children}
    </div>
  );
}
