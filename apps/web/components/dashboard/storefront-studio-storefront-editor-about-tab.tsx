"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";

export function StorefrontStudioStorefrontEditorAboutTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSectionSaving("aboutPage")
          ? "Saving page settings..."
          : document.isSectionDirty("aboutPage")
            ? "Changes save automatically."
            : "All page changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection
        title="Edit in preview"
        description="Most About content now edits directly in the preview so headings, article content, and story sections are changed in context."
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Use the preview to edit:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The “Who we are” article</li>
            <li>Section headings and supporting copy</li>
            <li>Structured story section titles and body text</li>
            <li>About section image, layout, order, add, and remove actions</li>
          </ul>
        </div>
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
