import { StorefrontCartLoading } from "@/components/storefront/storefront-cart-loading";
import { resolveStorefrontLoadingContext } from "@/lib/storefront/loading-theme";

export default async function CartLoading() {
  const context = await resolveStorefrontLoadingContext();

  return <StorefrontCartLoading context={context} />;
}
