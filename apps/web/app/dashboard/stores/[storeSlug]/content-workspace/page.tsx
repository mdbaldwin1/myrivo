import { redirect } from "next/navigation";
import { buildStorefrontStudioSurfaceHref, normalizeStorefrontStudioSurface } from "@/lib/store-editor/storefront-studio";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StoreWorkspaceContentWorkspaceIndexPage({ params, searchParams }: PageProps) {
  const { storeSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const surface = normalizeStorefrontStudioSurface(typeof resolvedSearchParams.surface === "string" ? resolvedSearchParams.surface : null);
  redirect(buildStorefrontStudioSurfaceHref(`/dashboard/stores/${storeSlug}/storefront-studio`, new URLSearchParams(), surface));
}
