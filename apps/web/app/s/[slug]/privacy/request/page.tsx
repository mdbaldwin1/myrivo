import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as generatePrivacyRequestMetadata } from "@/app/privacy/request/page";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontPrivacyRequestPage } from "@/components/storefront/storefront-privacy-request-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generatePrivacyRequestMetadata({ searchParams: Promise.resolve({ store: slug }) });
}

export default async function StorefrontSlugPrivacyRequestPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  await searchParams;
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return <StorefrontUnavailablePage state={unavailable} />;
    }
    notFound();
  }

  return (
    <StorefrontPrivacyRequestPage
      store={data.store}
      viewer={data.viewer}
      branding={data.branding}
      settings={data.settings}
      privacyProfile={data.privacyProfile}
    />
  );
}
