import Link from "next/link";
import Image from "next/image";

const highlights = [
  "A focused storefront built for At Home Apothecary",
  "Inventory and order workflows for makers",
  "Stripe checkout for secure direct payments"
];

export function HeroSection() {
  return (
    <section className="rounded-lg border border-border bg-card/80 p-8 shadow-sm backdrop-blur sm:p-10">
      <div className="flex items-center gap-2">
        <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Myrivo</p>
      </div>
      <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Build a branded commerce site in minutes.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Myrivo powers a single branded commerce experience with full control over catalog, styling, and fulfillment operations.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-foreground/90 sm:text-base">
        {highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2">
            <span aria-hidden className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Open Merchant Dashboard
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted/40"
        >
          Owner Login
        </Link>
      </div>
    </section>
  );
}
