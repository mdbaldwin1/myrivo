"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioWelcomePopupSettings } from "@/components/dashboard/storefront-studio-welcome-popup-settings";

export function StorefrontStudioStorefrontEditorWelcomePopupTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSettingsSaving
          ? "Saving popup settings..."
          : document.isSettingsDirty
            ? "Changes save automatically."
            : "All popup changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection
        title="Campaign behavior"
      >
        <StorefrontStudioWelcomePopupSettings />
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
