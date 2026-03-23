import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Multi-store commerce operations | Myrivo",
  description: "Run multiple stores with approvals, moderation, role-based access, and governance in one platform."
};

const controls = [
  "Approval and moderation queues from one admin workspace.",
  "Role-based access controls across user-level and store-level contexts.",
  "Store readiness, status, and governance controls before stores go live."
];

export default async function MultiStoreCommercePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/for" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Platform Teams</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Multi-store commerce with stronger platform control.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo fits teams that need storefronts and seller operations on one platform while still keeping approvals, permissions, and launch readiness
          under control.
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

        <article className="rounded-2xl border border-border bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--brand-secondary)))] p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">See where governance matters most</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">
            Compare Myrivo with the usual mix of marketplace rules, separate store tools, and manual oversight.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <MarketingTrackedButtonLink
              href="/signup"
              ctaKey="multi_store_launch_start_free"
              ctaLabel="Start free"
              sectionKey="architecture_card"
              conversionIntent="signup"
              className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"
            >
              Start free
            </MarketingTrackedButtonLink>
            <MarketingTrackedButtonLink
              href="/compare"
              ctaKey="multi_store_launch_compare"
              ctaLabel="Compare approaches"
              sectionKey="architecture_card"
              variant="outline"
              className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
            >
              Compare approaches
            </MarketingTrackedButtonLink>
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
