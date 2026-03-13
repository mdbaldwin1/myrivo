import { StorefrontEditorialLoading } from "@/components/storefront/storefront-editorial-loading";
import { resolveStorefrontLoadingContext } from "@/lib/storefront/loading-theme";

export default async function PrivacyRequestLoading() {
  const context = await resolveStorefrontLoadingContext();

  return <StorefrontEditorialLoading context={context} />;
}
