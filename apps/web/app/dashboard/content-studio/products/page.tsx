import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioProductsPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Content Studio · Products Page"
        description="Product page merchandising content and copy controls."
      />
      <StoreExperienceSectionForm
        title="Products Page Content"
        section="productsPage"
        description="Configure products-page behavior and copy labels."
        fields={[
          { key: "visibility.showSearch", label: "Show Search", type: "checkbox" },
          { key: "visibility.showSort", label: "Show Sort", type: "checkbox" },
          { key: "visibility.showAvailability", label: "Show Availability", type: "checkbox" },
          { key: "visibility.showOptionFilters", label: "Show Option Filters", type: "checkbox" },
          { key: "layout.filterLayout", label: "Filter Layout", type: "text", placeholder: "sidebar", description: "Use `sidebar` or `top` depending on your storefront theme support." },
          { key: "layout.filtersDefaultOpen", label: "Filters Open by Default", type: "checkbox" },
          { key: "layout.gridColumns", label: "Grid Columns", type: "number", placeholder: "3", description: "Typical values are 2-4 depending on product image density." },
          { key: "copy.home.shopProductsHeading", label: "Products Heading", type: "text", placeholder: "Shop Products" },
          { key: "copy.home.browseFilterTitle", label: "Filter Panel Title", type: "text", placeholder: "Browse & Filter" },
          { key: "copy.home.searchPlaceholder", label: "Search Placeholder", type: "text", placeholder: "Search products..." },
          { key: "copy.home.noProductsMatch", label: "No Results Message", type: "text", placeholder: "No products match your current filters." }
        ]}
      />
    </section>
  );
}
