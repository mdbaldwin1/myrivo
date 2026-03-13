import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type StorefrontSlugTermsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StorefrontSlugTermsPage({ params }: StorefrontSlugTermsPageProps) {
  const { slug } = await params;
  redirect(`/terms?store=${encodeURIComponent(slug)}`);
}
