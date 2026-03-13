import { redirect } from "next/navigation";

type StorefrontCookiePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StorefrontCookiePage({ params }: StorefrontCookiePageProps) {
  const { slug } = await params;
  redirect(`/cookies?store=${encodeURIComponent(slug)}`);
}
