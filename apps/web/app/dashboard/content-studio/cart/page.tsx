import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreExperienceSectionForm } from "@/components/dashboard/store-experience-section-form";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioCartPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Content Studio · Cart Page" description="Cart and pre-checkout messaging and copy." />
      <StoreExperienceSectionForm
        title="Cart Content"
        section="cartPage"
        description="Manage cart-page copy overrides."
        fields={[
          { key: "copy.cart.title", label: "Cart Title", type: "text", placeholder: "Your Cart", description: "Main heading shown at the top of the cart page." },
          { key: "copy.cart.subtitle", label: "Cart Subtitle", type: "textarea", rows: 2, description: "Short supporting text under the cart title." },
          { key: "copy.cart.checkout", label: "Checkout Button Label", type: "text", placeholder: "Checkout", description: "Primary action label to start checkout." },
          { key: "copy.cart.empty", label: "Empty Cart Message", type: "text", placeholder: "Your cart is empty.", description: "Shown when no cart items exist." }
        ]}
      />
    </section>
  );
}
