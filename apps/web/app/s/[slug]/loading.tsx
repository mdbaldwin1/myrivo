import { StorefrontHomeLoading } from "@/components/storefront/storefront-home-loading";
import { resolveStorefrontLoadingContext } from "@/lib/storefront/loading-theme";

type StorefrontLoadingProps = {
  params?: Promise<{ slug?: string }> | { slug?: string };
};

async function resolveSlug(params: StorefrontLoadingProps["params"]) {
  if (!params) {
    return null;
  }

  const resolved = await Promise.resolve(params);
  return resolved?.slug ?? null;
}

export default async function StorefrontLoading({ params }: StorefrontLoadingProps) {
  const slug = await resolveSlug(params);
  const context = await resolveStorefrontLoadingContext(slug);

  return <StorefrontHomeLoading context={context} />;
}
