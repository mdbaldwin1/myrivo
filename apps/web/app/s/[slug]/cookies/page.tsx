import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as generateCookiesMetadata } from "@/app/cookies/page";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontCookiePolicyPage } from "@/components/storefront/storefront-cookie-policy-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateCookiesMetadata({ searchParams: Promise.resolve({ store: slug }) });
}

export default async function StorefrontSlugCookiesPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return <StorefrontUnavailablePage state={unavailable} />;
    }
    notFound();
  }

  const runtime = createStorefrontRuntime({
    ...data,
    mode: "live",
    surface: "policies"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontCookiePolicyPage runtime={runtime} />
    </StorefrontRuntimeProvider>
  );
}
