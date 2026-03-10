import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Local pickup order software | Myrivo",
  description: "Manage local pickup windows, location options, and checkout behavior for local commerce on Myrivo."
};

const pickupCapabilities = [
  "Buyer-select or hidden-nearest pickup workflows.",
  "Pickup hours, blackout dates, and lead-time window controls.",
  "Order-level pickup metadata for reliable daily operations."
];

export default function LocalPickupOrdersPage() {
  return (
    <MarketingSiteChrome activePath="/for">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Local Pickup</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Local pickup checkout that avoids customer confusion.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Configure pickup windows and communication rules from one place so customers know exactly what to expect.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">Pickup workflows</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {pickupCapabilities.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">Ship less. Hand off better.</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">Use pickup-ready checkout and clear customer messaging with less manual back-and-forth.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">Start free</Button>
            </Link>
            <Link href="/docs/getting-started">
              <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
                Setup docs
              </Button>
            </Link>
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
