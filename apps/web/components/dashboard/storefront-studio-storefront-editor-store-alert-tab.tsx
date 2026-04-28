"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioStoreAlertSettings } from "@/components/dashboard/storefront-studio-store-alert-settings";

export function StorefrontStudioStorefrontEditorStoreAlertTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSettingsSaving
          ? "Saving alert settings..."
          : document.isSettingsDirty
            ? "Changes save automatically."
            : "All alert changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection title="Alert behavior">
        <StorefrontStudioStoreAlertSettings />
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
