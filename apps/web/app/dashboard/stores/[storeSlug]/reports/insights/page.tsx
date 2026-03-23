import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
  searchParams?: Promise<{ range?: string; compare?: string }>;
};

export default async function StoreWorkspaceReportsInsightsRedirectPage({ params, searchParams }: PageProps) {
  const { storeSlug } = await params;
  const filters = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();
  if (filters?.range) {
    query.set("range", filters.range);
  }
  if (filters?.compare) {
    query.set("compare", filters.compare);
  }

  const href = query.size > 0 ? `/dashboard/stores/${storeSlug}/analytics?${query.toString()}` : `/dashboard/stores/${storeSlug}/analytics`;
  redirect(href);
}
