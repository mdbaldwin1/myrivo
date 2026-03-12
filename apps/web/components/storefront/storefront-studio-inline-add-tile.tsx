"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StorefrontStudioInlineAddTileProps = {
  label: string;
  onClick: () => void;
  className?: string;
};

export function StorefrontStudioInlineAddTile({ label, onClick, className }: StorefrontStudioInlineAddTileProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "w-full rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm font-medium text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground",
        className
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <Plus className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
