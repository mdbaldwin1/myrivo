"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";

export function StorefrontStudioStorefrontEditorPoliciesTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSectionSaving("policiesPage")
          ? "Saving page settings..."
          : document.isSectionDirty("policiesPage")
            ? "Changes save automatically."
            : "All page changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection
        title="Edit in preview"
        description="Policies content now edits directly in the preview so headings, policy copy, support details, and FAQ entries are changed in context."
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Use the preview to edit:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Page title and subtitle</li>
            <li>Shipping and returns headings and policy body copy</li>
            <li>Support heading, intro, and support email</li>
            <li>FAQ items and fallback FAQ cards</li>
          </ul>
        </div>
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
