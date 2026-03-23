import { StorefrontProductsLoading } from "@/components/storefront/storefront-products-loading";
import { resolveStorefrontLoadingContext } from "@/lib/storefront/loading-theme";

export default async function ProductsLoading() {
  const context = await resolveStorefrontLoadingContext();

  return <StorefrontProductsLoading context={context} />;
}
