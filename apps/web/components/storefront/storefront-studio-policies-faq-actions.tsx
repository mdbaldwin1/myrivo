"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { Button } from "@/components/ui/button";
import { movePoliciesFaq, removePoliciesFaq, updatePoliciesFaq } from "@/lib/storefront/studio-structure";

type StorefrontStudioPoliciesFaqActionsProps = {
  faqId: string;
  isVisible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function StorefrontStudioPoliciesFaqActions({
  faqId,
  isVisible,
  canMoveUp,
  canMoveDown
}: StorefrontStudioPoliciesFaqActionsProps) {
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
        aria-label={isVisible ? "Hide FAQ item" : "Show FAQ item"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("policiesPage", (current) => updatePoliciesFaq(current, faqId, { isActive: !isVisible }));
          document.setSelection({ kind: "policies-faq", id: faqId });
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
        aria-label="Move FAQ up"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("policiesPage", (current) => movePoliciesFaq(current, faqId, "up"));
          document.setSelection({ kind: "policies-faq", id: faqId });
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
        aria-label="Move FAQ down"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("policiesPage", (current) => movePoliciesFaq(current, faqId, "down"));
          document.setSelection({ kind: "policies-faq", id: faqId });
        }}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
        aria-label="Remove FAQ item"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          document.setSectionDraft("policiesPage", (current) => removePoliciesFaq(current, faqId));
          document.clearSelection();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
