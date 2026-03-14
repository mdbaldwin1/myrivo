"use client";

import * as React from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import { getBoolean, getNumber, getString } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";

type ProductDetailToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  inputId: string;
};

function ProductDetailToggle({ label, description, checked, onChange, inputId }: ProductDetailToggleProps) {
  return (
    <StorefrontStudioStorefrontEditorPanelToggleRow
      label={label}
      inputId={inputId}
      description={description}
      checked={checked}
      onChange={onChange}
    />
  );
}

export function StorefrontStudioStorefrontEditorProductDetailTab() {
  const document = useOptionalStorefrontStudioDocument();

  if (!document) {
    return null;
  }

  const studioDocument = document;
  const section = studioDocument.getSectionDraft("productsPage");

  function update(path: string, value: unknown) {
    studioDocument.setSectionDraft("productsPage", (current) => setEditorValueAtPath(current, path, value));
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        studioDocument.isSectionSaving("productsPage")
          ? "Saving page settings..."
          : studioDocument.isSectionDirty("productsPage")
            ? "Changes save automatically."
            : "All page changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection
        title="Reviews"
      >
        <ProductDetailToggle
          inputId="product-detail-show-reviews"
          label="Show reviews on product detail"
          description="Display the reviews module on product detail pages."
          checked={getBoolean(section, "reviews.showOnProductDetail", true)}
          onChange={(checked) => update("reviews.showOnProductDetail", checked)}
        />
        <ProductDetailToggle
          inputId="product-detail-enable-review-form"
          label="Show review submission form"
          description="Let customers submit a new review from the product detail page."
          checked={getBoolean(section, "reviews.formEnabled", true)}
          onChange={(checked) => update("reviews.formEnabled", checked)}
        />
        <div className="space-y-3">
          <FormField label="Default sort">
            <Select value={getString(section, "reviews.defaultSort", "newest")} onChange={(event) => update("reviews.defaultSort", event.target.value)}>
              <option value="newest">Newest</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </Select>
          </FormField>
          <FormField label="Items per page">
            <Input
              type="number"
              min={1}
              max={50}
              value={getNumber(section, "reviews.itemsPerPage", 10)}
              onChange={(event) => update("reviews.itemsPerPage", Number.parseInt(event.target.value || "0", 10) || 0)}
            />
          </FormField>
        </div>
        <ProductDetailToggle
          inputId="product-detail-show-summary"
          label="Show summary"
          description="Display average rating and review count above the product-detail reviews list."
          checked={getBoolean(section, "reviews.showSummary", true)}
          onChange={(checked) => update("reviews.showSummary", checked)}
        />
        <ProductDetailToggle
          inputId="product-detail-show-verified-badge"
          label="Show verified badge"
          description="Display verified purchase badges in product-detail reviews."
          checked={getBoolean(section, "reviews.showVerifiedBadge", true)}
          onChange={(checked) => update("reviews.showVerifiedBadge", checked)}
        />
        <ProductDetailToggle
          inputId="product-detail-show-review-media"
          label="Show review media"
          description="Display customer-submitted review images on the product detail page."
          checked={getBoolean(section, "reviews.showMediaGallery", true)}
          onChange={(checked) => update("reviews.showMediaGallery", checked)}
        />
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
