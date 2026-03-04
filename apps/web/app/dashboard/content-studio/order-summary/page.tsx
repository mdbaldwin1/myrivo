import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioOrderSummaryPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Content Studio · Order Summary"
        description="Post-checkout confirmation page copy and messaging."
      />
      <StoreExperienceSectionForm
        title="Order Summary Content"
        section="orderSummaryPage"
        description="Configure post-checkout confirmation copy."
        fields={[
          { key: "copy.checkout.title", label: "Checkout Page Title", type: "text", placeholder: "Checkout", description: "Heading shown on the checkout status page." },
          { key: "copy.checkout.cancelled", label: "Cancelled Message", type: "text", placeholder: "Checkout was cancelled.", description: "Shown after customers cancel checkout." },
          {
            key: "copy.checkout.orderPlacedTemplate",
            label: "Order Placed Template",
            type: "text",
            description: "Confirmation message template. Supports {orderId}.",
            placeholder: "Order {orderId} placed successfully."
          },
          {
            key: "copy.checkout.finalizationFailed",
            label: "Finalization Failed Message",
            type: "text",
            description: "Shown if order finalization fails after payment.",
            placeholder: "Checkout finalization failed."
          }
        ]}
      />
    </section>
  );
}
