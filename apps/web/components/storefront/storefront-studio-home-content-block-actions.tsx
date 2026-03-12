"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { Button } from "@/components/ui/button";
import { moveHomeContentBlock, removeHomeContentBlock } from "@/lib/storefront/studio-structure";

type StorefrontStudioHomeContentBlockActionsProps = {
  blockId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
};

export function StorefrontStudioHomeContentBlockActions({
  blockId,
  canMoveUp,
  canMoveDown,
  isVisible,
  onToggleVisibility
}: StorefrontStudioHomeContentBlockActionsProps) {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-900/10 bg-white/95 p-1 shadow-sm opacity-0 transition group-hover/selection:opacity-100 group-focus-within/selection:opacity-100">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        aria-label={isVisible ? "Hide block" : "Show block"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleVisibility();
          document.setSelection({ kind: "home-content-block", id: blockId });
        }}
      >
        {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        disabled={!canMoveUp}
        aria-label="Move block up"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("home", (current) => moveHomeContentBlock(current, blockId, "up"));
          document.setSelection({ kind: "home-content-block", id: blockId });
        }}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full"
        disabled={!canMoveDown}
        aria-label="Move block down"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("home", (current) => moveHomeContentBlock(current, blockId, "down"));
          document.setSelection({ kind: "home-content-block", id: blockId });
        }}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
        aria-label="Remove block"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("home", (current) => removeHomeContentBlock(current, blockId));
          document.clearSelection();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
