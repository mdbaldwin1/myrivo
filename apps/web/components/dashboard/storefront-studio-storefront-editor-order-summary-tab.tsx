"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";

export function StorefrontStudioStorefrontEditorOrderSummaryTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }
  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSectionSaving("orderSummaryPage")
          ? "Saving page settings..."
          : document.isSectionDirty("orderSummaryPage")
            ? "Changes save automatically."
            : "All page changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection
        title="Preview states"
        description="Use the preview-state buttons in the canvas to inspect the return, cancelled, preparing, placed, and failed states, then edit the title and active message directly in the preview."
      >
        <p className="text-sm text-muted-foreground">
          The Order Summary page is state-driven, so the preview is the best place to understand how each message actually lands.
        </p>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection
        title="Edit in preview"
        separated
        description="The Order Summary title, cancelled message, order placed template, and failure message now edit directly in the preview based on the selected preview state."
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Use the preview to edit:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Checkout page title</li>
            <li>Cancelled message</li>
            <li>Order placed template</li>
            <li>Finalization failed message</li>
          </ul>
        </div>
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
