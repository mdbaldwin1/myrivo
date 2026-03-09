import Link from "next/link";
import { ClipboardList, Home, Info, Mail, Package, Settings, Shield, ShoppingCart } from "lucide-react";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

const contentWorkspaceSections = [
  {
    title: "Home Page",
    description: "Hero messaging, merchandising blocks, and above-the-fold storefront storytelling.",
    href: "home",
    icon: Home
  },
  {
    title: "Products Page",
    description: "Collection copy, grid presentation, and product-list framing.",
    href: "products",
    icon: Package
  },
  {
    title: "About Page",
    description: "Brand story, founder context, and trust-building editorial content.",
    href: "about",
    icon: Info
  },
  {
    title: "Policies",
    description: "Shipping, returns, and service expectations surfaced in a single place.",
    href: "policies",
    icon: Shield
  },
  {
    title: "Cart Page",
    description: "Checkout-adjacent reassurance, promotions, and conversion copy.",
    href: "cart",
    icon: ShoppingCart
  },
  {
    title: "Order Summary",
    description: "Post-purchase messaging that keeps confirmation and fulfillment expectations clear.",
    href: "order-summary",
    icon: ClipboardList
  },
  {
    title: "Emails",
    description: "Transactional message voice and support-oriented delivery content.",
    href: "emails",
    icon: Mail
  }
] as const;

export default async function StoreWorkspaceContentWorkspaceIndexPage({ params }: PageProps) {
  const { storeSlug } = await params;

  return (
    <DashboardPageScaffold
      title="Content Workspace"
      description="Choose the storefront surface you want to edit. This root route is the canonical entrypoint for content operations."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Workspace flow
          </CardTitle>
          <CardDescription>
            Use this overview to move between content surfaces. Legacy `content-studio` links redirect here or to the matching section.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contentWorkspaceSections.map((section) => (
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
                href={`/dashboard/stores/${storeSlug}/content-workspace/${section.href}`}
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
