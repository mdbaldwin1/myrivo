import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type StorefrontAboutRouteParams = {
  params: Promise<{ slug: string }>;
};

export default async function StorefrontSlugAboutPage({ params }: StorefrontAboutRouteParams) {
  const resolvedParams = await params;
  redirect(`/about?store=${encodeURIComponent(resolvedParams.slug)}`);
}
