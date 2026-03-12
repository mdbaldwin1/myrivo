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

type ProductsToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  inputId: string;
};

function ProductsToggle({ label, description, checked, onChange, inputId }: ProductsToggleProps) {
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

export function StorefrontStudioStorefrontEditorProductsTab() {
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
      <StorefrontStudioStorefrontEditorPanelTabSection title="Discovery">
        <ProductsToggle inputId="products-show-search" label="Show search" description="Display the catalog search input." checked={getBoolean(section, "visibility.showSearch", true)} onChange={(checked) => update("visibility.showSearch", checked)} />
        <ProductsToggle inputId="products-show-sort" label="Show sort" description="Display catalog sort controls." checked={getBoolean(section, "visibility.showSort", true)} onChange={(checked) => update("visibility.showSort", checked)} />
        <ProductsToggle inputId="products-show-availability-filter" label="Show availability filter" description="Display availability filtering." checked={getBoolean(section, "visibility.showAvailability", true)} onChange={(checked) => update("visibility.showAvailability", checked)} />
        <ProductsToggle inputId="products-show-option-filters" label="Show option filters" description="Display size/color/etc. option filters." checked={getBoolean(section, "visibility.showOptionFilters", true)} onChange={(checked) => update("visibility.showOptionFilters", checked)} />
        {getBoolean(section, "visibility.showOptionFilters", true) ? (
          <>
            <FormField label="Filter layout">
              <Select value={getString(section, "layout.filterLayout", "sidebar")} onChange={(event) => update("layout.filterLayout", event.target.value)}>
                <option value="sidebar">Sidebar</option>
                <option value="topbar">Top bar</option>
              </Select>
            </FormField>
            <ProductsToggle inputId="products-filters-default-open" label="Filters open by default" description="Start option filters expanded." checked={getBoolean(section, "layout.filtersDefaultOpen", false)} onChange={(checked) => update("layout.filtersDefaultOpen", checked)} />
          </>
        ) : null}
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Catalog layout" separated>
        <FormField label="Grid columns">
          <Select value={String(getNumber(section, "layout.gridColumns", 3))} onChange={(event) => update("layout.gridColumns", Number.parseInt(event.target.value, 10))}>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </Select>
        </FormField>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Product cards" separated>
        <ProductsToggle inputId="products-show-description" label="Show description" description="Display product descriptions on cards." checked={getBoolean(section, "productCards.showDescription", true)} onChange={(checked) => update("productCards.showDescription", checked)} />
        {getBoolean(section, "productCards.showDescription", true) ? (
          <FormField label="Description lines">
            <Input type="number" value={getNumber(section, "productCards.descriptionLines", 2)} onChange={(event) => update("productCards.descriptionLines", Number.parseInt(event.target.value || "0", 10) || 0)} />
          </FormField>
        ) : null}
        <ProductsToggle inputId="products-show-featured-badge" label="Show featured badge" description="Display the featured badge on featured products." checked={getBoolean(section, "productCards.showFeaturedBadge", true)} onChange={(checked) => update("productCards.showFeaturedBadge", checked)} />
        <ProductsToggle inputId="products-show-availability-badge" label="Show availability badge" description="Display inventory or option availability on cards." checked={getBoolean(section, "productCards.showAvailability", true)} onChange={(checked) => update("productCards.showAvailability", checked)} />
        <ProductsToggle inputId="products-show-quick-add" label="Show quick add" description="Display quick-add buttons directly on cards." checked={getBoolean(section, "productCards.showQuickAdd", true)} onChange={(checked) => update("productCards.showQuickAdd", checked)} />
        <ProductsToggle inputId="products-image-hover-zoom" label="Image hover zoom" description="Enable hover zoom on product media." checked={getBoolean(section, "productCards.imageHoverZoom", true)} onChange={(checked) => update("productCards.imageHoverZoom", checked)} />
        <ProductsToggle inputId="products-show-carousel-arrows" label="Show carousel arrows" description="Display navigation arrows for multi-image products." checked={getBoolean(section, "productCards.showCarouselArrows", true)} onChange={(checked) => update("productCards.showCarouselArrows", checked)} />
        <ProductsToggle inputId="products-show-carousel-dots" label="Show carousel dots" description="Display pagination dots for multi-image cards." checked={getBoolean(section, "productCards.showCarouselDots", true)} onChange={(checked) => update("productCards.showCarouselDots", checked)} />
        <FormField label="Image fit">
          <Select value={getString(section, "productCards.imageFit", "cover")} onChange={(event) => update("productCards.imageFit", event.target.value)}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </Select>
        </FormField>
      </StorefrontStudioStorefrontEditorPanelTabSection>

      <StorefrontStudioStorefrontEditorPanelTabSection title="Reviews" separated>
        <ProductsToggle inputId="products-enable-reviews" label="Enable reviews" description="Show reviews across storefront surfaces." checked={getBoolean(section, "reviews.enabled", true)} onChange={(checked) => update("reviews.enabled", checked)} />
        <ProductsToggle inputId="products-show-reviews-home" label="Show reviews on home" description="Display the store reviews module on the home page." checked={getBoolean(section, "reviews.showOnHome", true)} onChange={(checked) => update("reviews.showOnHome", checked)} />
        <p className="text-sm text-muted-foreground">
          Product-detail review visibility, sort, summary, badge, and media controls now live on the Product Detail tab.
        </p>
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
