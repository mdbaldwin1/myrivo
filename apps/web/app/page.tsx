import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { withReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);
  const primaryCta = isAuthenticated
    ? { label: "Open Dashboard", href: "/dashboard", variant: "default" as const }
    : { label: "Create account", href: "/signup", variant: "default" as const };
  const secondaryCta = isAuthenticated
    ? { label: "My Account", href: "/account", variant: "outline" as const }
    : { label: "Sign in", href: withReturnTo("/login", "/"), variant: "outline" as const };

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <div className="space-y-6 py-8">
        <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Myrivo</p>
          <h1 className="mt-2 text-4xl font-semibold">Launch and run a branded, multi-store commerce platform.</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Myrivo gives merchants storefront content workspace controls, pickup intelligence, automated email workflows, and platform-grade controls for billing,
            roles, white-labeling, and sandbox mode.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={primaryCta.href}>
              <Button variant={primaryCta.variant}>{primaryCta.label}</Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button variant={secondaryCta.variant}>{secondaryCta.label}</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline">View pricing</Button>
            </Link>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="For Store Owners">
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Content Workspace for page-by-page merchandising</li>
              <li>Configurable pickup workflows with radius and schedules</li>
              <li>Promotion, subscriber, and order lifecycle controls</li>
            </ul>
          </SectionCard>
          <SectionCard title="For Platform Operators">
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Global roles: admin, support, user</li>
              <li>Store role matrix: owner, staff, customer</li>
              <li>Plan-based fees, test mode, and white-label domains</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
