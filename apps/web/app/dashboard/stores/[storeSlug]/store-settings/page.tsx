import Link from "next/link";
import { Cog, Globe, Paintbrush, Plug, ReceiptText, Settings, Store, Truck, Users } from "lucide-react";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

const storeSettingsSections = [
  {
    title: "General",
    description: "Store identity, publish state, and baseline SEO information.",
    href: "general",
    icon: Cog
  },
  {
    title: "Branding",
    description: "Theme tokens, logos, and the presentation layer shared across the storefront.",
    href: "branding",
    icon: Paintbrush
  },
  {
    title: "Team",
    description: "Membership roles, invites, and operational access control.",
    href: "team",
    icon: Users
  },
  {
    title: "Shipping",
    description: "Delivery rules, shipping policies, and fulfillment expectations.",
    href: "shipping",
    icon: Truck
  },
  {
    title: "Pickup",
    description: "Pickup availability, scheduling windows, and location rules.",
    href: "pickup",
    icon: Store
  },
  {
    title: "Checkout Experience",
    description: "Order thresholds, checkout messaging, and cart-to-checkout guardrails.",
    href: "checkout-experience",
    icon: ReceiptText
  },
  {
    title: "Domains",
    description: "Custom domain verification and storefront address management.",
    href: "domains",
    icon: Globe
  },
  {
    title: "Integrations",
    description: "Payments and provider connections that support store operations.",
    href: "integrations",
    icon: Plug
  }
] as const;

export default async function StoreWorkspaceStoreSettingsIndexPage({ params }: PageProps) {
  const { storeSlug } = await params;

  return (
    <DashboardPageScaffold
      title="Store Settings"
      description="Start from the overview, then move into the operational area you need. This root route is the canonical settings entrypoint."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Workspace flow
          </CardTitle>
          <CardDescription>
            Settings subsections stay stable, but overview-first navigation removes the competing entrypoints that previously dropped users into
            different defaults.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {storeSettingsSections.map((section) => (
          <Card key={section.href} className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <section.icon className="h-5 w-5 text-muted-foreground" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/dashboard/stores/${storeSlug}/store-settings/${section.href}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center")}
              >
                Open {section.title}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardPageScaffold>
  );
}
