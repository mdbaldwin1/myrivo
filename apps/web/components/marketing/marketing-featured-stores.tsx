"use client";

import { useState } from "react";

type FeaturedStoreData = {
  id: string;
  name: string;
  slug: string;
  storefrontUrl: string;
  customDomain: string | null;
};

export function MarketingFeaturedStores({ stores }: { stores: FeaturedStoreData[] }) {
  if (stores.length === 0) {
    return null;
  }

  return (
    <section className="marketing-rise marketing-delay-2 mt-24 sm:mt-28">
      <div className="max-w-4xl">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Live on Myrivo</p>
        <h2 className="mt-4 [font-family:'Fraunces','Iowan_Old_Style','Palatino_Linotype',serif] text-3xl leading-tight text-foreground sm:text-4xl">
          Real stores, real products.
        </h2>
        <p className="mt-4 text-base leading-8 text-muted-foreground">
          See what sellers are building on the platform right now.
        </p>
      </div>

      <div className={`mt-10 grid gap-6 ${stores.length === 1 ? "grid-cols-1" : "lg:grid-cols-2"}`}>
        {stores.map((store) => (
          <FeaturedStoreCard key={store.id} store={store} />
        ))}
      </div>
    </section>
  );
}

function FeaturedStoreCard({ store }: { store: FeaturedStoreData }) {
  const [hovered, setHovered] = useState(false);
  const visitUrl = store.customDomain ? `https://${store.customDomain}` : store.storefrontUrl;

  return (
    <div
      className="group relative overflow-hidden rounded-[2rem] border border-border/60 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <iframe
          src={store.storefrontUrl}
          title={`${store.name} storefront`}
          className="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50 border-0"
          loading="lazy"
          tabIndex={-1}
          sandbox="allow-same-origin allow-scripts"
        />

        <a
          href={visitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`absolute inset-0 z-10 flex items-end justify-end p-5 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
          style={{ backgroundColor: "rgba(255, 255, 255, 0.35)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-lg transition-transform group-hover:scale-105">
            Visit store
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 12L12 4M12 4H6M12 4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </a>
      </div>
    </div>
  );
}

export type { FeaturedStoreData };
