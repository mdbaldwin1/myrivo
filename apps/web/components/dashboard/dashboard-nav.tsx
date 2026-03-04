"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignoutButton } from "@/components/dashboard/signout-button";
import { StoreSwitcher, type StoreOption } from "@/components/dashboard/store-switcher";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GlobalUserRole, StoreRecord } from "@/types/database";

type DashboardNavProps = {
  storeStatus: StoreRecord["status"] | null;
  storeSlug: string | null;
  activeStoreSlug: string | null;
  stores: StoreOption[];
  globalRole: GlobalUserRole;
};

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/catalog", label: "Catalog" },
  { href: "/dashboard/orders", label: "Orders" }
];

const storeSettingsLinks = [
  { href: "/dashboard/store-settings/profile", label: "Profile" },
  { href: "/dashboard/store-settings/branding", label: "Branding" },
  { href: "/dashboard/store-settings/checkout-rules", label: "Checkout Rules" },
  { href: "/dashboard/store-settings/integrations", label: "Integrations" }
] as const;

const contentStudioLinks = [
  { href: "/dashboard/content-studio/home", label: "Home" },
  { href: "/dashboard/content-studio/products", label: "Products Page" },
  { href: "/dashboard/content-studio/about", label: "About Page" },
  { href: "/dashboard/content-studio/policies", label: "Policies Page" },
  { href: "/dashboard/content-studio/cart", label: "Cart Page" },
  { href: "/dashboard/content-studio/order-summary", label: "Order Summary" },
  { href: "/dashboard/content-studio/emails", label: "Emails" }
] as const;

const marketingLinks = [
  { href: "/dashboard/marketing/promotions", label: "Promotions" },
  { href: "/dashboard/marketing/subscribers", label: "Email Subscribers" }
] as const;

export function DashboardNav({ storeStatus, storeSlug, activeStoreSlug, stores, globalRole }: DashboardNavProps) {
  const pathname = usePathname();
  const storefrontLabel = storeStatus === "active" ? "View storefront" : "Preview storefront";
  const normalizedPath = pathname?.replace(/\/$/, "") ?? "";
  const hasStoreAccess = stores.length > 0 && Boolean(activeStoreSlug);
  const canAccessPlatform = globalRole === "support" || globalRole === "admin";

  return (
    <nav className="h-fit rounded-lg border border-border bg-card p-3 lg:sticky lg:top-6">
      {hasStoreAccess ? (
        <div className="mb-3 border-b border-border px-2 pb-3">
          <StoreSwitcher activeStoreSlug={activeStoreSlug!} stores={stores} />
        </div>
      ) : null}
      <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Navigation</p>
      <div className="space-y-1">
        {(hasStoreAccess ? links : []).map((link) => {
          const normalizedHref = link.href.replace(/\/$/, "");
          const isOverviewLink = normalizedHref === "/dashboard";
          const isActive = isOverviewLink
            ? normalizedPath === "/dashboard"
            : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
            >
              {link.label}
            </Link>
          );
        })}

        {hasStoreAccess ? <div className="pt-2">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Store Settings</p>
          <div className="space-y-1 pl-2">
            {storeSettingsLinks.map((link) => {
              const normalizedHref = link.href.replace(/\/$/, "");
              const isActive = normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }),
                    "w-full justify-start"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div> : null}

        {hasStoreAccess ? <div className="pt-2">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Content Studio</p>
          <div className="space-y-1 pl-2">
            {contentStudioLinks.map((link) => {
              const normalizedHref = link.href.replace(/\/$/, "");
              const isActive = normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }),
                    "w-full justify-start"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div> : null}

        {hasStoreAccess ? <div className="pt-2">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Marketing</p>
          <div className="space-y-1 pl-2">
            {marketingLinks.map((link) => {
              const normalizedHref = link.href.replace(/\/$/, "");
              const isActive = normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }),
                    "w-full justify-start"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div> : null}

        {canAccessPlatform ? (
          <div className="pt-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform</p>
            <div className="space-y-1 pl-2">
              <Link
                href="/dashboard/platform"
                className={cn(
                  buttonVariants({ variant: normalizedPath === "/dashboard/platform" ? "default" : "ghost", size: "sm" }),
                  "w-full justify-start"
                )}
              >
                Platform Console
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <Link href="/dashboard/account" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-start")}>
          Profile & Account
        </Link>
        {storeSlug ? (
          <Link href={`/s/${storeSlug}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-start")}>
            {storefrontLabel}
          </Link>
        ) : null}
        <SignoutButton />
      </div>
    </nav>
  );
}
