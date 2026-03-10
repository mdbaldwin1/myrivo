import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Multi-store commerce platform | Myrivo",
  description: "Operate multiple storefronts with governance, approvals, and role-based admin controls in Myrivo."
};

const controls = [
  "Admin workspace for approval queue, moderation queue, and audit timeline.",
  "Role-based access controls across user-level and store-level contexts.",
  "Store readiness and governance controls before stores go live."
];

export default function MultiStoreCommercePage() {
  return (
    <MarketingSiteChrome activePath="/for">
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Platform Teams</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Multi-store commerce with serious platform governance.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Operate many stores without losing control of risk, permissions, or operational consistency.
        </p>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-6">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl text-foreground">Platform controls</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {controls.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">See the architecture</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">Review operational tradeoffs, governance depth, and launch strategy in minutes.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">Start free</Button>
            </Link>
            <Link href="/compare">
              <Button variant="outline" className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10">
                Compare approaches
              </Button>
            </Link>
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
