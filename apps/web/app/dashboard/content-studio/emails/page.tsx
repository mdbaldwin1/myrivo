import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioEmailsPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Content Studio · Emails"
        description="Newsletter and transactional email copy controls."
      />
      <StoreExperienceSectionForm
        title="Email Content"
        section="emails"
        description="Configure newsletter capture copy and optional transactional email templates."
        fields={[
          { key: "newsletterCapture.enabled", label: "Enable Newsletter Capture", type: "checkbox", description: "Controls footer email signup visibility on storefront pages." },
          { key: "newsletterCapture.heading", label: "Newsletter Heading", type: "text", placeholder: "Get updates from the shop" },
          { key: "newsletterCapture.description", label: "Newsletter Description", type: "textarea", rows: 3, placeholder: "New releases, restocks, and occasional offers." },
          { key: "newsletterCapture.successMessage", label: "Newsletter Success Message", type: "text", placeholder: "Thanks for subscribing." },
          { key: "transactional.customerConfirmationSubjectTemplate", label: "Customer Confirmation Subject Template", type: "text", description: "Subject line sent to customer after order creation." },
          { key: "transactional.customerConfirmationBodyTemplate", label: "Customer Confirmation Body Template", type: "textarea", rows: 8, description: "Supports template placeholders used by order emails." },
          { key: "transactional.ownerNewOrderSubjectTemplate", label: "Owner New Order Subject Template", type: "text", description: "Subject line for owner/store notifications." },
          { key: "transactional.ownerNewOrderBodyTemplate", label: "Owner New Order Body Template", type: "textarea", rows: 8, description: "Body template for owner/store order notifications." },
          { key: "transactional.shippedSubjectTemplate", label: "Shipped Subject Template", type: "text" },
          { key: "transactional.shippedBodyTemplate", label: "Shipped Body Template", type: "textarea", rows: 6 },
          { key: "transactional.deliveredSubjectTemplate", label: "Delivered Subject Template", type: "text" },
          { key: "transactional.deliveredBodyTemplate", label: "Delivered Body Template", type: "textarea", rows: 6 }
        ]}
      />
    </section>
  );
}
