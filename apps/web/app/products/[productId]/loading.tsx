import { StorefrontProductDetailLoading } from "@/components/storefront/storefront-product-detail-loading";
import { resolveStorefrontLoadingContext } from "@/lib/storefront/loading-theme";

export default async function ProductDetailLoading() {
  const context = await resolveStorefrontLoadingContext();

  return <StorefrontProductDetailLoading context={context} />;
}
