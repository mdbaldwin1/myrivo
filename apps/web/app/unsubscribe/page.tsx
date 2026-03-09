import { NewsletterUnsubscribeForm } from "@/components/storefront/newsletter-unsubscribe-form";

type UnsubscribePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const storeRaw = resolved?.store;
  const initialStore = typeof storeRaw === "string" ? storeRaw.trim() : "";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-6 py-12">
      <NewsletterUnsubscribeForm initialStore={initialStore} />
    </main>
  );
}
