import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioPoliciesPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Content Studio · Policies Page" description="Policy copy and FAQ content for customer trust." />
      <StoreExperienceSectionForm
        title="Policies Content"
        section="policiesPage"
        description="Manage shipping, returns, support contact, and policy FAQs."
        fields={[
          { key: "supportEmail", label: "Support Email", type: "text", placeholder: "support@example.com", description: "Displayed on policy/support sections and used in customer guidance copy." },
          { key: "shippingPolicy", label: "Shipping Policy", type: "textarea", rows: 6, description: "Public policy text shown on the storefront policies page." },
          { key: "returnPolicy", label: "Return Policy", type: "textarea", rows: 6, description: "Explain eligibility, timeframe, and condition requirements." },
          { key: "policyFaqs", label: "Policy FAQs", type: "policyFaqs", description: "Common questions rendered in the FAQ section of the policies page." },
          { key: "copy.policies.title", label: "Page Title", type: "text", placeholder: "Policies" },
          { key: "copy.policies.subtitle", label: "Page Subtitle", type: "textarea", rows: 3 },
          { key: "copy.policies.shippingHeading", label: "Shipping Section Heading", type: "text", placeholder: "How shipping works" },
          { key: "copy.policies.returnsHeading", label: "Returns Section Heading", type: "text", placeholder: "Returns and exchanges" }
        ]}
      />
    </section>
  );
}
