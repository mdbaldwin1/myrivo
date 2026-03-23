"use client";

import * as React from "react";
import { useId } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import { getBoolean, getNumber, getString } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";

export function StorefrontStudioStorefrontEditorHomeTab() {
  const document = useOptionalStorefrontStudioDocument();
  const showHeroId = useId();
  const heroBrandDisplayId = useId();
  const showContentBlocksId = useId();
  const showFeaturedProductsId = useId();
  const showReviewsOnHomeId = useId();

  if (!document) {
    return null;
  }

  const section = document.getSectionDraft("home");
  const productsSection = document.getSectionDraft("productsPage");
  const showHero = getBoolean(section, "visibility.showHero", true);

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSectionSaving("home") || document.isSectionSaving("productsPage")
          ? "Saving page settings..."
          : document.isSectionDirty("home") || document.isSectionDirty("productsPage")
            ? "Changes save automatically."
            : "All page changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection title="Hero section">
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show hero section"
          inputId={showHeroId}
          description="Toggle the Home hero section."
          checked={showHero}
          onChange={(checked) => document.setSectionDraft("home", (current) => setEditorValueAtPath(current, "visibility.showHero", checked))}
        />

        {showHero ? (
          <>
            <FormField label="Hero layout">
              <Select value={getString(section, "hero.layout") || "split"} onChange={(event) => document.setSectionDraft("home", (current) => setEditorValueAtPath(current, "hero.layout", event.target.value))}>
                <option value="split">Split</option>
                <option value="centered">Centered</option>
              </Select>
            </FormField>
            <FormField label="Hero image size">
              <Select value={getString(section, "hero.imageSize") || "medium"} onChange={(event) => document.setSectionDraft("home", (current) => setEditorValueAtPath(current, "hero.imageSize", event.target.value))}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </Select>
            </FormField>
            <FormField label="Hero brand display" inputId={heroBrandDisplayId}>
              <Select
                id={heroBrandDisplayId}
                value={getString(section, "hero.brandDisplay") || "title"}
                onChange={(event) =>
                  document.setSectionDraft("home", (current) => setEditorValueAtPath(current, "hero.brandDisplay", event.target.value))
                }
              >
                <option value="title">Title only</option>
                <option value="logo">Logo only</option>
                <option value="logo_and_title">Logo and title</option>
              </Select>
            </FormField>
          </>
        ) : null}
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Content blocks" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show content blocks"
          inputId={showContentBlocksId}
          description="Toggle the reusable content-block section."
          checked={getBoolean(section, "visibility.showContentBlocks", true)}
          onChange={(checked) => document.setSectionDraft("home", (current) => setEditorValueAtPath(current, "visibility.showContentBlocks", checked))}
        />
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Featured products" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show featured products"
          inputId={showFeaturedProductsId}
          description="Toggle the featured-products section."
          checked={getBoolean(section, "visibility.showFeaturedProducts", true)}
          onChange={(checked) => document.setSectionDraft("home", (current) => setEditorValueAtPath(current, "visibility.showFeaturedProducts", checked))}
        />
        <FormField label="Featured limit">
          <Input
            type="number"
            value={getNumber(section, "visibility.featuredProductsLimit", 6)}
            onChange={(event) =>
              document.setSectionDraft("home", (current) =>
                setEditorValueAtPath(current, "visibility.featuredProductsLimit", Number.parseInt(event.target.value || "0", 10) || 0)
              )
            }
          />
        </FormField>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Reviews" separated>
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Show reviews on home"
          inputId={showReviewsOnHomeId}
          description="Display the store reviews module on the Home page."
          checked={getBoolean(productsSection, "reviews.showOnHome", true)}
          onChange={(checked) => document.setSectionDraft("productsPage", (current) => setEditorValueAtPath(current, "reviews.showOnHome", checked))}
        />
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
