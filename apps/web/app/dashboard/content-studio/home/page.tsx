import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioHomePage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Content Studio · Home"
        description="High-frequency storefront storytelling and merchandising content."
      />
      <StoreExperienceSectionForm
        title="Home Content"
        section="home"
        description="Manage hero, announcement, featured-products behavior, and content blocks."
        fields={[
          { key: "announcement", label: "Announcement Bar Text", type: "text", description: "Short strip shown at the very top of storefront pages." },
          { key: "fulfillmentMessage", label: "Fulfillment Message", type: "textarea", rows: 3, description: "Displayed in hero/about areas to set shipping or pickup expectations." },
          { key: "hero.eyebrow", label: "Hero Eyebrow", type: "text", description: "Small pre-headline line above the hero title." },
          { key: "hero.headline", label: "Hero Headline", type: "text", description: "Primary marketing headline on the home hero." },
          { key: "hero.subcopy", label: "Hero Subcopy", type: "textarea", rows: 3, description: "Supporting sentence(s) under the hero headline." },
          { key: "hero.badgeOne", label: "Hero Badge 1", type: "text" },
          { key: "hero.badgeTwo", label: "Hero Badge 2", type: "text" },
          { key: "hero.badgeThree", label: "Hero Badge 3", type: "text" },
          { key: "hero.brandDisplay", label: "Hero Brand Display", type: "text", placeholder: "title", description: "Allowed values: title, logo, or logo_and_title." },
          { key: "visibility.showHero", label: "Show Hero", type: "checkbox" },
          { key: "visibility.showContentBlocks", label: "Show Content Blocks", type: "checkbox" },
          { key: "visibility.showFeaturedProducts", label: "Show Featured Products", type: "checkbox" },
          { key: "visibility.featuredProductsLimit", label: "Featured Products Limit", type: "number", placeholder: "6", description: "Maximum number of featured products shown on home." },
          { key: "contentBlocks", label: "Home Content Blocks", type: "contentBlocks", description: "Reusable informational blocks shown below the hero." },
          { key: "copy.home.shopProductsCta", label: "Shop Products CTA", type: "text", placeholder: "Shop products" },
          { key: "copy.home.aboutBrandCta", label: "About Brand CTA", type: "text", placeholder: "About the brand" },
          { key: "copy.home.contentBlocksHeading", label: "Content Blocks Heading", type: "text", placeholder: "Our Approach" },
          { key: "copy.home.featuredProductsHeading", label: "Featured Products Heading", type: "text", placeholder: "Featured Products" }
        ]}
      />
    </section>
  );
}
