import { StorefrontStudio } from "@/components/dashboard/storefront-studio";
import { normalizeStorefrontStudioEditorTarget } from "@/lib/store-editor/storefront-studio";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StoreWorkspaceStorefrontStudioPage({ params, searchParams }: PageProps) {
  const { storeSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const surface = typeof resolvedSearchParams.surface === "string" ? resolvedSearchParams.surface : null;
  const editor = typeof resolvedSearchParams.editor === "string" ? normalizeStorefrontStudioEditorTarget(resolvedSearchParams.editor) : null;
  const storefrontData = await loadStorefrontData(storeSlug);

  return (
    <StorefrontStudio
      storeSlug={storeSlug}
      initialSurface={surface}
      initialEditorTarget={editor}
      initialStorefrontData={storefrontData}
    />
  );
}
