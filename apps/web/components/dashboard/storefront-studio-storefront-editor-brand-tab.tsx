"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioColorField } from "@/components/dashboard/storefront-studio-color-field";
import { StorefrontStudioFontSelector } from "@/components/dashboard/storefront-studio-font-selector";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { ensureStorefrontBrandingDraft } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { resolveStorefrontThemeConfig, type CtaStyle } from "@/lib/theme/storefront-theme";

export function StorefrontStudioStorefrontEditorBrandTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  const studioDocument = document;
  const brandingDraft = ensureStorefrontBrandingDraft(studioDocument.brandingDraft);
  const theme = resolveStorefrontThemeConfig(brandingDraft.theme_json ?? {});

  function patchTheme(partial: Record<string, unknown>) {
    studioDocument.setBrandingDraft((current) => ({
      ...ensureStorefrontBrandingDraft(current),
      theme_json: {
        ...((ensureStorefrontBrandingDraft(current).theme_json ?? {}) as Record<string, unknown>),
        ...partial
      }
    }));
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        studioDocument.isBrandingSaving
          ? "Saving brand settings..."
          : studioDocument.isBrandingDirty
            ? "Changes save automatically."
            : "All brand changes saved."
      }
    >
      <p className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Use this tab for visual brand controls like colors, typography, spacing, and CTA style. Browser icons, social preview images, and SEO metadata live in Store Settings &gt; General.
      </p>
      <FormField label="Primary">
        <StorefrontStudioColorField
          value={brandingDraft.primary_color ?? "#0F7B84"}
          fallback="#0F7B84"
          onChange={(value) => studioDocument.setBrandingDraft((current) => ({ ...ensureStorefrontBrandingDraft(current), primary_color: value }))}
        />
      </FormField>
      <FormField label="Primary foreground">
        <StorefrontStudioColorField value={theme.primaryForegroundColor ?? "#FFFFFF"} fallback="#FFFFFF" onChange={(value) => patchTheme({ primaryForegroundColor: value })} />
      </FormField>
      <FormField label="Accent">
        <StorefrontStudioColorField
          value={brandingDraft.accent_color ?? "#1AA3A8"}
          fallback="#1AA3A8"
          onChange={(value) => studioDocument.setBrandingDraft((current) => ({ ...ensureStorefrontBrandingDraft(current), accent_color: value }))}
        />
      </FormField>
      <FormField label="Accent foreground">
        <StorefrontStudioColorField value={theme.accentForegroundColor ?? "#FFFFFF"} fallback="#FFFFFF" onChange={(value) => patchTheme({ accentForegroundColor: value })} />
      </FormField>
      <FormField label="Background">
        <StorefrontStudioColorField value={theme.backgroundColor ?? "#F5FBFB"} fallback="#F5FBFB" onChange={(value) => patchTheme({ backgroundColor: value })} />
      </FormField>
      <FormField label="Surface">
        <StorefrontStudioColorField value={theme.surfaceColor ?? "#FFFFFF"} fallback="#FFFFFF" onChange={(value) => patchTheme({ surfaceColor: value })} />
      </FormField>
      <FormField label="Text">
        <StorefrontStudioColorField value={theme.textColor ?? "#143435"} fallback="#143435" onChange={(value) => patchTheme({ textColor: value })} />
      </FormField>
      <FormField label="Page width">
        <Select value={theme.pageWidth} onChange={(event) => patchTheme({ pageWidth: event.target.value })}>
          <option value="narrow">Narrow</option>
          <option value="standard">Standard</option>
          <option value="wide">Wide</option>
        </Select>
      </FormField>
      <FormField label="Font family">
        <StorefrontStudioFontSelector value={theme.fontFamily} onChange={(value) => patchTheme({ fontFamily: value })} />
      </FormField>
      <FormField label="Corner radius">
        <Select value={theme.radiusScale} onChange={(event) => patchTheme({ radiusScale: event.target.value })}>
          <option value="soft">Soft</option>
          <option value="rounded">Rounded</option>
          <option value="sharp">Sharp</option>
        </Select>
      </FormField>
      <FormField label="Card style">
        <Select value={theme.cardStyle} onChange={(event) => patchTheme({ cardStyle: event.target.value })}>
          <option value="integrated">Integrated</option>
          <option value="solid">Solid</option>
          <option value="outline">Outline</option>
          <option value="elevated">Elevated</option>
        </Select>
      </FormField>
      <FormField label="Page spacing">
        <Select value={theme.spacingScale} onChange={(event) => patchTheme({ spacingScale: event.target.value })}>
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="airy">Airy</option>
        </Select>
      </FormField>
      <FormField label="Primary CTA style">
        <Select value={theme.primaryCtaStyle} onChange={(event) => patchTheme({ primaryCtaStyle: event.target.value as CtaStyle })}>
          <option value="primary">Primary</option>
          <option value="accent">Accent</option>
          <option value="outline">Outline</option>
        </Select>
      </FormField>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
