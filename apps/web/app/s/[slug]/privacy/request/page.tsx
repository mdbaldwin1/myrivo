import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StorefrontScopedPrivacyRequestRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/privacy/request?store=${encodeURIComponent(slug)}`);
}
