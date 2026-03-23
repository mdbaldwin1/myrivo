"use client";

import * as React from "react";
import { useId } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import { ensureStorefrontBrandingDraft, ensureStorefrontSettingsDraft } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { resolveStorefrontThemeConfig, type FooterItemId } from "@/lib/theme/storefront-theme";

const FOOTER_NAV_OPTIONS: Array<{ id: FooterItemId; label: string }> = [
  { id: "products", label: "Products" },
  { id: "cart", label: "Cart" },
  { id: "about", label: "About" },
  { id: "policies", label: "Policies" }
];

export function StorefrontStudioStorefrontEditorFooterTab() {
  const document = useOptionalStorefrontStudioDocument();
  const footerBackToTopId = useId();
  const footerOwnerLoginId = useId();
  const newsletterModuleId = useId();

  if (!document) {
    return null;
  }

  const studioDocument = document;
  const theme = resolveStorefrontThemeConfig(ensureStorefrontBrandingDraft(studioDocument.brandingDraft).theme_json ?? {});
  const settingsDraft = studioDocument.settingsDraft;
  const showNewsletterModule = Boolean(settingsDraft?.email_capture_enabled);

  function patchTheme(partial: Record<string, unknown>) {
    studioDocument.setBrandingDraft((current) => ({
      ...ensureStorefrontBrandingDraft(current),
      theme_json: {
        ...((ensureStorefrontBrandingDraft(current).theme_json ?? {}) as Record<string, unknown>),
        ...partial
      }
    }));
  }

  function toggleFooterNavItem(id: FooterItemId, checked: boolean) {
    const currentItems = [...theme.footerNavItems];
    const nextItems = checked ? [...currentItems, id] : currentItems.filter((item) => item !== id);
    patchTheme({ footerNavItems: nextItems });
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        studioDocument.isSettingsSaving
          ? "Saving footer newsletter settings..."
          : studioDocument.isBrandingSaving
            ? "Saving footer settings..."
            : studioDocument.isBrandingDirty || studioDocument.isSettingsDirty
              ? "Changes save automatically."
              : "All footer changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection title="Page links">
        <div className="space-y-2">
          {FOOTER_NAV_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={theme.footerNavItems.includes(option.id)} onChange={({ target }) => toggleFooterNavItem(option.id, target.checked)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Newsletter" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show newsletter module"
          inputId={newsletterModuleId}
          description="Display the “Join our email list” signup section in the footer."
          checked={showNewsletterModule}
          onChange={(checked) =>
            studioDocument.setSettingsDraft((current) => ({
              ...ensureStorefrontSettingsDraft(current),
              email_capture_enabled: checked
            }))
          }
        />
        {showNewsletterModule ? (
          <FormField label="Success message">
            <Input
              value={settingsDraft?.email_capture_success_message ?? ""}
              onChange={(event) =>
                studioDocument.setSettingsDraft((current) => ({
                  ...ensureStorefrontSettingsDraft(current),
                  email_capture_success_message: event.target.value
                }))
              }
            />
          </FormField>
        ) : null}
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Socials" separated>
        <FormField label="Instagram URL">
          <Input
            value={settingsDraft?.instagram_url ?? ""}
            onChange={(event) =>
              studioDocument.setSettingsDraft((current) => ({
                ...ensureStorefrontSettingsDraft(current),
                instagram_url: event.target.value || null
              }))
            }
            placeholder="https://instagram.com/yourstore"
          />
        </FormField>
        <FormField label="Facebook URL">
          <Input
            value={settingsDraft?.facebook_url ?? ""}
            onChange={(event) =>
              studioDocument.setSettingsDraft((current) => ({
                ...ensureStorefrontSettingsDraft(current),
                facebook_url: event.target.value || null
              }))
            }
            placeholder="https://facebook.com/yourstore"
          />
        </FormField>
        <FormField label="TikTok URL">
          <Input
            value={settingsDraft?.tiktok_url ?? ""}
            onChange={(event) =>
              studioDocument.setSettingsDraft((current) => ({
                ...ensureStorefrontSettingsDraft(current),
                tiktok_url: event.target.value || null
              }))
            }
            placeholder="https://tiktok.com/@yourstore"
          />
        </FormField>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Other" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show footer back-to-top link"
          inputId={footerBackToTopId}
          description="Display a back-to-top shortcut in the footer."
          checked={theme.showFooterBackToTop}
          onChange={(checked) => patchTheme({ showFooterBackToTop: checked })}
        />
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show footer owner login"
          inputId={footerOwnerLoginId}
          description="Display the owner login shortcut in the footer."
          checked={theme.showFooterOwnerLogin}
          onChange={(checked) => patchTheme({ showFooterOwnerLogin: checked })}
        />
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
