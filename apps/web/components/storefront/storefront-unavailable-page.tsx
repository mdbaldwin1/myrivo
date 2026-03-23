import Image from "next/image";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { createDefaultStoreExperienceContent } from "@/lib/store-experience/content";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import type { StorefrontUnavailableData, StorefrontUnavailableKind } from "@/lib/storefront/unavailable";

type StorefrontUnavailablePageProps = {
  state: StorefrontUnavailableData;
};

function copyForState(kind: StorefrontUnavailableKind) {
  if (kind === "offline") {
    return {
      eyebrow: "Temporarily Offline",
      title: "This storefront is temporarily offline",
      body: "The store owner has taken this storefront offline for now. Please check back again soon."
    };
  }

  return {
    eyebrow: "Coming Soon",
    title: "This storefront is coming soon",
    body: "This store is still getting ready to launch. Check back soon for the full storefront experience."
  };
}

export function StorefrontUnavailablePage({ state }: StorefrontUnavailablePageProps) {
  const copy = copyForState(state.kind);
  const runtime = createStorefrontRuntime({
    store: state.store,
    viewer: state.viewer,
    branding: state.branding,
    settings: state.settings,
    contentBlocks: [],
    products: [],
    experienceContent: createDefaultStoreExperienceContent(),
    mode: "live",
    surface: "home"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <main className="min-h-screen bg-[var(--storefront-bg)] px-6 py-16 text-[var(--storefront-fg)]">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center">
          <section className="w-full rounded-[var(--storefront-radius-card)] border border-[hsl(var(--border))] bg-white/90 p-8 text-center shadow-sm backdrop-blur sm:p-12">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
              {state.branding?.logo_path ? (
                <Image
                  src={state.branding.logo_path}
                  alt={`${state.store.name} logo`}
                  width={240}
                  height={120}
                  unoptimized
                  className="h-auto max-h-24 w-auto max-w-full object-contain"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted text-xl font-semibold">
                  {state.store.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{copy.eyebrow}</p>
                <h1 className="text-3xl font-semibold [font-family:var(--storefront-font-heading)] sm:text-4xl">{copy.title}</h1>
                <p className="mx-auto max-w-xl text-base leading-7 text-muted-foreground">{copy.body}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{state.store.name}</p>
                {state.settings?.announcement ? <p className="text-sm text-muted-foreground">{state.settings.announcement}</p> : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    </StorefrontRuntimeProvider>
  );
}
