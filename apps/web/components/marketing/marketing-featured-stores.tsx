import Image from "next/image";
import Link from "next/link";

type FeaturedProduct = {
  id: string;
  title: string;
  image_url: string | null;
  price_cents: number;
};

type FeaturedStoreData = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  primary_color: string | null;
  accent_color: string | null;
  tagline: string | null;
  products: FeaturedProduct[];
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

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {stores.map((store) => (
          <FeaturedStoreCard key={store.id} store={store} />
        ))}
      </div>
    </section>
  );
}

function FeaturedStoreCard({ store }: { store: FeaturedStoreData }) {
  const storeHref = `/s/${store.slug}`;
  const primaryColor = store.primary_color || "#0F7B84";

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-border/60 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ borderBottom: `2px solid ${primaryColor}18` }}
      >
        {store.logo_path ? (
          <Image
            src={store.logo_path}
            alt={`${store.name} logo`}
            width={200}
            height={80}
            unoptimized
            className="h-10 w-auto max-w-[120px] object-contain"
          />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {store.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground">{store.name}</h3>
          {store.tagline ? (
            <p className="truncate text-sm text-muted-foreground">{store.tagline}</p>
          ) : null}
        </div>
      </div>

      {store.products.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 px-6 py-5">
          {store.products.slice(0, 3).map((product) => (
            <div key={product.id} className="space-y-2">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-border/40 bg-muted/10">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div>
                <p className="truncate text-xs font-medium text-foreground">{product.title}</p>
                <p className="text-xs text-muted-foreground">${(product.price_cents / 100).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="border-t border-border/40 px-6 py-4">
        <Link
          href={storeHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: primaryColor }}
        >
          Visit store
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </article>
  );
}

export type { FeaturedStoreData };
