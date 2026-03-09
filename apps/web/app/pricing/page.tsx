import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { withReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PricingPage() {
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
    : { label: "Sign in", href: withReturnTo("/login", "/pricing"), variant: "outline" as const };

  return (
    <PageShell>
      <div className="space-y-4">
        <SectionCard title="Myrivo Pricing" description="Platform and transaction pricing for merchants.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Starter plan includes hosted storefront, content workspace, and order management.</p>
            <p>Transaction fees and payout details are configured per billing plan and captured in billing events.</p>
            <p>For current rates and enterprise pricing, contact support or review your store billing settings.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={primaryCta.href}>
              <Button variant={primaryCta.variant}>{primaryCta.label}</Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button variant={secondaryCta.variant}>{secondaryCta.label}</Button>
            </Link>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
