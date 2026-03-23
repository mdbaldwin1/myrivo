import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Local pickup storefronts | Myrivo",
  description: "Run local pickup with scheduling, location rules, checkout gating, and clearer customer messaging in one platform."
};

const pickupCapabilities = [
  "Let buyers choose pickup locations or automatically assign the nearest location when that fits the model.",
  "Control pickup hours, blackout dates, lead windows, and checkout availability.",
  "Keep pickup details and fulfillment context attached to each order after checkout."
];

export default async function LocalPickupOrdersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);

  return (
    <MarketingSiteChrome activePath="/for" isAuthenticated={isAuthenticated}>
      <section className="marketing-rise rounded-3xl border border-border bg-card p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">For Local Pickup</p>
        <h1 className="mt-4 [font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-4xl leading-tight text-foreground sm:text-5xl">
          Local pickup checkout without the usual confusion.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Myrivo fits sellers who rely on pickup windows, location rules, and clear handoff messaging as much as the storefront itself.
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

        <article className="rounded-2xl border border-border bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--brand-secondary)))] p-6 text-primary-foreground">
          <h2 className="[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif] text-2xl">Keep pickup smooth from checkout to handoff</h2>
          <p className="mt-3 text-sm text-[hsl(var(--primary-foreground))]">
            Use pickup-ready checkout, order context, and customer communication without separate scheduling tools.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <MarketingTrackedButtonLink
              href="/signup"
              ctaKey="pickup_launch_start_free"
              ctaLabel="Start free"
              sectionKey="launch_card"
              conversionIntent="signup"
              className="h-10 rounded-full bg-background px-5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"
            >
              Start free
            </MarketingTrackedButtonLink>
            <MarketingTrackedButtonLink
              href="/features"
              ctaKey="pickup_launch_setup_docs"
              ctaLabel="View features"
              sectionKey="launch_card"
              variant="outline"
              className="h-10 rounded-full border-[hsl(var(--primary-foreground))]/50 bg-transparent px-5 text-primary-foreground hover:bg-white/10"
            >
              View features
            </MarketingTrackedButtonLink>
          </div>
        </article>
      </section>
    </MarketingSiteChrome>
  );
}
