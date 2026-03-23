import { StorefrontCheckoutLoading } from "@/components/storefront/storefront-checkout-loading";
import { resolveStorefrontLoadingContext } from "@/lib/storefront/loading-theme";

export default async function CheckoutLoading() {
  const context = await resolveStorefrontLoadingContext();

  return <StorefrontCheckoutLoading context={context} />;
}
