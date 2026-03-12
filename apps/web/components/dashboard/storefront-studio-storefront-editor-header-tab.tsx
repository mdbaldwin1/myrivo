"use client";

import * as React from "react";
import { useId } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioColorField } from "@/components/dashboard/storefront-studio-color-field";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import { ensureStorefrontBrandingDraft, getBoolean } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";
import { resolveStorefrontThemeConfig, type NavItemId } from "@/lib/theme/storefront-theme";

const HEADER_NAV_OPTIONS: Array<{ id: NavItemId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "products", label: "Products" },
  { id: "about", label: "About" },
  { id: "policies", label: "Policies" }
];

export function StorefrontStudioStorefrontEditorHeaderTab() {
  const document = useOptionalStorefrontStudioDocument();
  const announcementId = useId();
  const logoId = useId();
  const titleId = useId();

  if (!document) {
    return null;
  }

  const studioDocument = document;
  const homeSection = studioDocument.getSectionDraft("home");
  const brandingDraft = ensureStorefrontBrandingDraft(studioDocument.brandingDraft);
  const themeJson = (brandingDraft.theme_json as Record<string, unknown>) ?? {};
  const theme = resolveStorefrontThemeConfig(themeJson);
  const showLogo = getBoolean(themeJson, "headerShowLogo", true);
  const showTitle = getBoolean(themeJson, "headerShowTitle", true);

  function patchTheme(partial: Record<string, unknown>) {
    studioDocument.setBrandingDraft((current) => ({
      ...ensureStorefrontBrandingDraft(current),
      theme_json: {
        ...((ensureStorefrontBrandingDraft(current).theme_json ?? {}) as Record<string, unknown>),
        ...partial
      }
    }));
  }

  function toggleHeaderNavItem(id: NavItemId, checked: boolean) {
    const currentItems = [...theme.headerNavItems];
    const nextItems = checked ? [...currentItems, id] : currentItems.filter((item) => item !== id);
    patchTheme({ headerNavItems: nextItems });
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        studioDocument.isBrandingSaving
          ? "Saving header settings..."
          : studioDocument.isBrandingDirty || studioDocument.isSectionDirty("home")
            ? "Changes save automatically."
            : "All header changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection title="Announcement">
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show announcement bar"
          inputId={announcementId}
          description="Display the shared announcement strip at the top of the storefront."
          checked={getBoolean(homeSection, "visibility.showPolicyStrip", true)}
          onChange={(checked) => studioDocument.setSectionDraft("home", (current) => setEditorValueAtPath(current, "visibility.showPolicyStrip", checked))}
        />
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Logo" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show logo"
          inputId={logoId}
          description="Display the store logo in the shared header."
          checked={showLogo}
          onChange={(checked) => patchTheme({ headerShowLogo: checked })}
        />
        {showLogo ? (
          <FormField label="Logo size">
            <Select value={typeof themeJson.headerLogoSize === "string" ? themeJson.headerLogoSize : "medium"} onChange={(event) => patchTheme({ headerLogoSize: event.target.value })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </Select>
          </FormField>
        ) : null}
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Title" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show title"
          inputId={titleId}
          description="Display the store name in the shared header."
          checked={showTitle}
          onChange={(checked) => patchTheme({ headerShowTitle: checked })}
        />
        {showTitle ? (
          <FormField label="Title size">
            <Select value={typeof themeJson.headerTitleSize === "string" ? themeJson.headerTitleSize : "medium"} onChange={(event) => patchTheme({ headerTitleSize: event.target.value })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </Select>
          </FormField>
        ) : null}
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Colors" separated>
        <FormField label="Header background">
          <StorefrontStudioColorField value={theme.headerBackgroundColor ?? "#FFFFFF"} fallback="#FFFFFF" onChange={(value) => patchTheme({ headerBackgroundColor: value })} />
        </FormField>
        <FormField label="Header foreground">
          <StorefrontStudioColorField value={theme.headerForegroundColor ?? "#143435"} fallback="#143435" onChange={(value) => patchTheme({ headerForegroundColor: value })} />
        </FormField>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Links" separated>
        <div className="space-y-2">
          {HEADER_NAV_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={theme.headerNavItems.includes(option.id)} onChange={({ target }) => toggleHeaderNavItem(option.id, target.checked)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
