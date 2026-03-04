import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioAboutPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Content Studio · About Page" description="Brand story article and structured sections." />
      <StoreExperienceSectionForm
        title="About Content"
        section="aboutPage"
        description="Manage narrative article content and visual story sections."
        fields={[
          {
            key: "aboutArticleHtml",
            label: "About Article HTML",
            type: "textarea",
            rows: 14,
            description: "Long-form brand story content. Basic HTML is supported.",
            placeholder: "<p>Tell your brand story...</p>"
          },
          { key: "aboutSections", label: "About Sections", type: "aboutSections", description: "Structured story blocks with optional image and layout control." },
          { key: "copy.about.ourStoryHeading", label: "Story Heading", type: "text", placeholder: "Our Story" },
          { key: "copy.about.whatShapesOurWorkHeading", label: "Philosophy Heading", type: "text", placeholder: "What Shapes Our Work" },
          { key: "copy.about.questionsHeading", label: "Questions Heading", type: "text", placeholder: "We're happy to help" }
        ]}
      />
    </section>
  );
}
