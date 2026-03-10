import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise rounded-3xl border border-border bg-card p-7 shadow-[0_30px_70px_rgba(29,51,23,0.08)] sm:p-10">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded-full border border-primary/20 bg-muted px-3 py-1">Commerce OS</span>
          <span className="rounded-full border border-primary/20 bg-muted px-3 py-1">White-label ready</span>
          <span className="rounded-full border border-primary/20 bg-muted px-3 py-1">Built for operators</span>
        </div>
        <h1 className="mt-5 max-w-4xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-6xl">
          The storefront platform that runs your entire operation, not just checkout.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Myrivo gives you one system for merchandising, order ops, shipping and pickup, customer communication, and platform governance.
          No brittle plugin stack. No fragmented admin.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={isAuthenticated ? "/dashboard" : "/signup"}>
            <Button className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary">
              {isAuthenticated ? "Open dashboard" : "Start free"}
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" className="h-11 rounded-full border-[hsl(var(--primary))]/35 bg-card px-6 text-[hsl(var(--primary))] hover:bg-primary/10">
              See pricing
            </Button>
          </Link>
        </div>
      </section>

      <section className="marketing-rise marketing-delay-1 mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Revenue Operations</p>
          <p className="mt-2 text-sm text-foreground">Catalog, inventory, promotions, billing, and reporting in one accountable workflow.</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Fulfillment Control</p>
          <p className="mt-2 text-sm text-foreground">Pickup windows, shipping events, and order states built for real-world fulfillment teams.</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Platform Governance</p>
          <p className="mt-2 text-sm text-foreground">Role-based access, moderation, legal acceptance tracking, and audit history out of the box.</p>
        </article>
      </section>

      <section className="marketing-rise marketing-delay-2 mt-8 rounded-3xl border border-border bg-primary p-8 text-primary-foreground sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--primary-foreground))]">How teams use Myrivo</p>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]">01</p>
            <p className="mt-2 text-base font-semibold">Launch fast</p>
            <p className="mt-1 text-sm text-[hsl(var(--primary-foreground))]">Stand up branded storefronts with product variants, policy content, and checkout rules.</p>
          </div>
          <div>
            <p className="text-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]">02</p>
            <p className="mt-2 text-base font-semibold">Operate reliably</p>
            <p className="mt-1 text-sm text-[hsl(var(--primary-foreground))]">Run order ops with shipping states, pickup workflows, low-stock alerts, and notifications.</p>
          </div>
          <div>
            <p className="text-2xl [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]">03</p>
            <p className="mt-2 text-base font-semibold">Scale with control</p>
            <p className="mt-1 text-sm text-[hsl(var(--primary-foreground))]">Add stores, govern staff access, enforce approvals, and manage trust workflows centrally.</p>
          </div>
        </div>
      </section>
    </MarketingSiteChrome>
  );
}
