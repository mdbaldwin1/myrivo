import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type StorefrontSlugPrivacyPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StorefrontSlugPrivacyPage({ params }: StorefrontSlugPrivacyPageProps) {
  const { slug } = await params;
  redirect(`/privacy?store=${encodeURIComponent(slug)}`);
}
