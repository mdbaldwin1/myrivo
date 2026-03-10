import { StorefrontStudio } from "@/components/dashboard/storefront-studio";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StoreWorkspaceContentWorkspaceIndexPage({ params, searchParams }: PageProps) {
  const { storeSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const surface = typeof resolvedSearchParams.surface === "string" ? resolvedSearchParams.surface : null;
  return <StorefrontStudio storeSlug={storeSlug} initialSurface={surface} />;
}
