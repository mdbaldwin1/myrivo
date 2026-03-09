import { resolvePrimaryDomainForStoreSlug } from "@/lib/stores/domain-store";

export type CustomerStorefrontLinks = {
  storefrontHref: string;
  cartHref: string;
};

export async function resolveCustomerStorefrontLinksBySlug(storeSlugs: string[]): Promise<Record<string, CustomerStorefrontLinks>> {
  const uniqueSlugs = Array.from(
    new Set(
      storeSlugs
        .map((slug) => slug.trim().toLowerCase())
        .filter((slug) => slug.length > 0)
    )
  );

  const entries = await Promise.all(
    uniqueSlugs.map(async (slug) => {
      const primaryDomain = await resolvePrimaryDomainForStoreSlug(slug);
      if (primaryDomain) {
        return [
          slug,
          {
            storefrontHref: `https://${primaryDomain}`,
            cartHref: `https://${primaryDomain}/cart`
          } satisfies CustomerStorefrontLinks
        ] as const;
      }

      return [
        slug,
        {
          storefrontHref: `/s/${encodeURIComponent(slug)}`,
          cartHref: `/cart?store=${encodeURIComponent(slug)}`
        } satisfies CustomerStorefrontLinks
      ] as const;
    })
  );

  return Object.fromEntries(entries);
}
