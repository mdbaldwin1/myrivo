"use client";

import type { ReactNode } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { getBooleanValue, getNumberValue, getStringValue } from "@/components/dashboard/store-experience-form-utils";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";

type ContentWorkspaceProductsFormProps = {
  header?: ReactNode;
};

export function ContentWorkspaceProductsForm({ header }: ContentWorkspaceProductsFormProps) {
  const formId = "content-workspace-products-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("productsPage");

  const showSearch = getBooleanValue(draft, "visibility.showSearch", true);
  const showSort = getBooleanValue(draft, "visibility.showSort", true);
  const showAvailabilityFilter = getBooleanValue(draft, "visibility.showAvailability", true);
  const showOptionFilters = getBooleanValue(draft, "visibility.showOptionFilters", true);

  const showDescription = getBooleanValue(draft, "productCards.showDescription", true);
  const showFeaturedBadge = getBooleanValue(draft, "productCards.showFeaturedBadge", true);
  const showAvailabilityBadge = getBooleanValue(draft, "productCards.showAvailability", true);
  const showQuickAdd = getBooleanValue(draft, "productCards.showQuickAdd", true);
  const imageHoverZoom = getBooleanValue(draft, "productCards.imageHoverZoom", true);
  const showCarouselArrows = getBooleanValue(draft, "productCards.showCarouselArrows", true);
  const showCarouselDots = getBooleanValue(draft, "productCards.showCarouselDots", true);
  const reviewsEnabled = getBooleanValue(draft, "reviews.enabled", true);
  const reviewsShowOnHome = getBooleanValue(draft, "reviews.showOnHome", true);
  const reviewsShowOnProductDetail = getBooleanValue(draft, "reviews.showOnProductDetail", true);
  const reviewsFormEnabled = getBooleanValue(draft, "reviews.formEnabled", true);
  const reviewsShowVerifiedBadge = getBooleanValue(draft, "reviews.showVerifiedBadge", true);
  const reviewsShowMediaGallery = getBooleanValue(draft, "reviews.showMediaGallery", true);
  const reviewsShowSummary = getBooleanValue(draft, "reviews.showSummary", true);

  return (
    <form
      id={formId}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "discard") {
          discard();
          return;
        }
        void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading section...</p> : null}

        <SectionCard title="Filters and Search" description="Control which catalog filtering and discovery tools are visible to shoppers.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Show Search" description="Displays the product search field.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSearch}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showSearch", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showSearch ? (
              <FormField label="Search Placeholder" description="Placeholder text shown inside the search input.">
                <Input
                  value={getStringValue(draft, "copy.home.searchPlaceholder")}
                  onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.searchPlaceholder", event.target.value))}
                  placeholder="Search products..."
                />
              </FormField>
            ) : null}

            <FormField label="Show Sort" description="Displays product sort controls.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSort}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showSort", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Availability Filter" description="Displays availability filtering in the catalog controls.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showAvailabilityFilter}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showAvailability", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Option Filters" description="Displays option-based filtering (size, color, etc.).">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOptionFilters}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showOptionFilters", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showOptionFilters ? (
              <>
                <FormField label="Filter Layout" description="Choose where filters render in the products page.">
                  <Select
                    value={getStringValue(draft, "layout.filterLayout", "sidebar")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "layout.filterLayout", event.target.value))}
                  >
                    <option value="sidebar">Sidebar</option>
                    <option value="topbar">Top bar</option>
                  </Select>
                </FormField>
                <FormField label="Filters Open by Default" description="Controls whether option filters start expanded.">
                  <label className="flex h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={getBooleanValue(draft, "layout.filtersDefaultOpen", false)}
                      onChange={(event) => setDraft((current) => setAtPath(current, "layout.filtersDefaultOpen", event.target.checked))}
                    />
                    Enabled
                  </label>
                </FormField>
              </>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Catalog Layout" description="Grid density and overall product listing structure.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Grid Columns" description="Number of product cards per row (desktop).">
              <Select
                value={String(getNumberValue(draft, "layout.gridColumns", 3))}
                onChange={(event) => setDraft((current) => setAtPath(current, "layout.gridColumns", Number.parseInt(event.target.value, 10)))}
              >
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </Select>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Product Cards" description="Card-level presentation and interaction controls.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Show Description" description="Displays product description text on each card.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDescription}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.showDescription", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showDescription ? (
              <FormField label="Description Lines" description="Clamp description text between 1 and 4 lines.">
                <Input
                  type="number"
                  value={getNumberValue(draft, "productCards.descriptionLines", 2)}
                  onChange={(event) =>
                    setDraft((current) =>
                      setAtPath(current, "productCards.descriptionLines", Number.parseInt(event.target.value || "0", 10) || 0)
                    )
                  }
                />
              </FormField>
            ) : null}

            <FormField label="Show Featured Badge" description="Displays a featured badge for featured products.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showFeaturedBadge}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.showFeaturedBadge", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Availability Badge" description="Displays availability status on each product card.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showAvailabilityBadge}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.showAvailability", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Quick Add" description="Displays quick-add controls directly on product cards.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showQuickAdd}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.showQuickAdd", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Enable Image Hover Zoom" description="Applies a subtle zoom effect on product image hover.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={imageHoverZoom}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.imageHoverZoom", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Carousel Arrows" description="Shows image carousel arrows on multi-image product cards.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showCarouselArrows}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.showCarouselArrows", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Carousel Dots" description="Shows image carousel pagination dots on multi-image cards.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showCarouselDots}
                  onChange={(event) => setDraft((current) => setAtPath(current, "productCards.showCarouselDots", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Image Fit" description="How product images fit inside card media area.">
              <Select
                value={getStringValue(draft, "productCards.imageFit", "cover")}
                onChange={(event) => setDraft((current) => setAtPath(current, "productCards.imageFit", event.target.value))}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </Select>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Reviews" description="Control review visibility, behavior, and customer-facing review copy.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Enable Reviews" description="Shows reviews across storefront pages.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsEnabled}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.enabled", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Allow Review Submissions" description="Shows or hides the write-a-review form.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsFormEnabled}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.formEnabled", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show on Home Page" description="Displays review module on storefront home.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsShowOnHome}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.showOnHome", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show on Product Page" description="Displays review module on product detail pages.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsShowOnProductDetail}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.showOnProductDetail", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Default Sort">
              <Select
                value={getStringValue(draft, "reviews.defaultSort", "newest")}
                onChange={(event) => setDraft((current) => setAtPath(current, "reviews.defaultSort", event.target.value))}
              >
                <option value="newest">Newest</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </Select>
            </FormField>

            <FormField label="Items Per Page" description="How many reviews to load initially and per Load More request.">
              <Input
                type="number"
                min={1}
                max={50}
                value={getNumberValue(draft, "reviews.itemsPerPage", 10)}
                onChange={(event) =>
                  setDraft((current) => setAtPath(current, "reviews.itemsPerPage", Number.parseInt(event.target.value || "0", 10) || 0))
                }
              />
            </FormField>

            <FormField label="Show Summary" description="Displays average rating and review count.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsShowSummary}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.showSummary", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Verified Badge" description="Displays verified purchase badge on review cards.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsShowVerifiedBadge}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.showVerifiedBadge", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Show Review Media" description="Displays customer-submitted review images.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewsShowMediaGallery}
                  onChange={(event) => setDraft((current) => setAtPath(current, "reviews.showMediaGallery", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            <FormField label="Section Title">
              <Input
                value={getStringValue(draft, "copy.reviews.sectionTitle", "Reviews")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.sectionTitle", event.target.value))}
              />
            </FormField>

            <FormField label="Summary Template" description="Use {average} and {count} placeholders.">
              <Input
                value={getStringValue(draft, "copy.reviews.summaryTemplate", "{average} average from {count} reviews")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.summaryTemplate", event.target.value))}
              />
            </FormField>

            <FormField label="Empty State Message">
              <Input
                value={getStringValue(draft, "copy.reviews.emptyState", "No published reviews yet.")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.emptyState", event.target.value))}
              />
            </FormField>

            <FormField label="Load More Label">
              <Input
                value={getStringValue(draft, "copy.reviews.loadMore", "Load more")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.loadMore", event.target.value))}
              />
            </FormField>

            <FormField label="Form Title">
              <Input
                value={getStringValue(draft, "copy.reviews.formTitle", "Write a review")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.formTitle", event.target.value))}
              />
            </FormField>

            <FormField label="Submit Label">
              <Input
                value={getStringValue(draft, "copy.reviews.submitButton", "Submit review")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.submitButton", event.target.value))}
              />
            </FormField>

            <FormField label="Submitting Label">
              <Input
                value={getStringValue(draft, "copy.reviews.submittingButton", "Submitting...")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.submittingButton", event.target.value))}
              />
            </FormField>

            <FormField label="Success Message" className="sm:col-span-2">
              <Input
                value={getStringValue(draft, "copy.reviews.moderationSuccessMessage", "Thanks. Your review was submitted and is awaiting moderation.")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.reviews.moderationSuccessMessage", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          title="Products Copy"
          description="Edit customer-facing labels and helper text used in the products catalog and filter UI."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Products Heading" description="Primary heading text for the products page.">
              <Input
                value={getStringValue(draft, "copy.home.shopProductsHeading")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.shopProductsHeading", event.target.value))}
              />
            </FormField>
            <FormField label="Filter Panel Title" description="Title shown above the filters panel.">
              <Input
                value={getStringValue(draft, "copy.home.browseFilterTitle")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.browseFilterTitle", event.target.value))}
              />
            </FormField>
            <FormField label="No Results Message" description="Message shown when no products match current filters.">
              <Input
                value={getStringValue(draft, "copy.home.noProductsMatch")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.noProductsMatch", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

      </div>
      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save"
        savePendingLabel="Saving..."
        discardLabel="Discard"
        savePending={saving}
        saveDisabled={!isDirty || saving || loading}
        discardDisabled={!isDirty || saving || loading}
        statusMessage={error}
        statusVariant="error"
      />
    </form>
  );
}
