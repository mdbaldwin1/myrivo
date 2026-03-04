"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { StoreSwitcher, type StoreOption } from "@/components/dashboard/store-switcher";
import { buttonVariants, Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GlobalUserRole } from "@/types/database";

type DashboardNavProps = {
  activeStoreSlug: string | null;
  stores: StoreOption[];
  globalRole: GlobalUserRole;
  userDisplayName: string | null;
  userEmail: string | null;
};

type SectionKey = "navigation" | "store-settings" | "content-studio" | "marketing" | "platform";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/catalog", label: "Catalog" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/billing", label: "Billing" }
];

const storeSettingsLinks = [
  { href: "/dashboard/store-settings/profile", label: "Profile" },
  { href: "/dashboard/store-settings/branding", label: "Branding" },
  { href: "/dashboard/store-settings/team", label: "Team" },
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

function getInitials(name: string | null, email: string | null) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0]!.slice(0, 2).toUpperCase();
    }
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  const emailPrefix = email?.split("@")[0] ?? "";
  return emailPrefix.slice(0, 2).toUpperCase() || "ME";
}

export function DashboardNav({ activeStoreSlug, stores, globalRole, userDisplayName, userEmail }: DashboardNavProps) {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, "") ?? "";
  const hasStoreAccess = stores.length > 0 && Boolean(activeStoreSlug);
  const canAccessPlatform = globalRole === "support" || globalRole === "admin";
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    navigation: false,
    "store-settings": false,
    "content-studio": false,
    marketing: false,
    platform: false
  });
  const initials = getInitials(userDisplayName, userEmail);
  const accountName = userDisplayName?.trim() || "My Account";
  const accountEmail = userEmail?.trim() || "No email";

  const isLinkActive = (href: string) => {
    const normalizedHref = href.replace(/\/$/, "");
    const isOverviewLink = normalizedHref === "/dashboard";
    return isOverviewLink
      ? normalizedPath === "/dashboard"
      : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
  };

  const sectionHasActiveLink: Record<SectionKey, boolean> = {
    navigation: links.some((link) => isLinkActive(link.href)),
    "store-settings": storeSettingsLinks.some((link) => isLinkActive(link.href)),
    "content-studio": contentStudioLinks.some((link) => isLinkActive(link.href)),
    marketing: marketingLinks.some((link) => isLinkActive(link.href)),
    platform: isLinkActive("/dashboard/platform")
  };

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  function toggleSection(section: SectionKey) {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function isSectionOpen(section: SectionKey) {
    return sectionHasActiveLink[section] || !collapsedSections[section];
  }

  return (
    <nav className="h-fit rounded-lg border border-border bg-card p-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:flex lg:flex-col">
      {hasStoreAccess ? (
        <div className="mb-3 border-b border-border px-2 pb-3 lg:shrink-0">
          <StoreSwitcher activeStoreSlug={activeStoreSlug!} stores={stores} />
        </div>
      ) : null}
      <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="space-y-2">
          {hasStoreAccess ? (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("navigation")}
                className="flex w-full items-center justify-between px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>Navigation</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isSectionOpen("navigation") ? "rotate-180" : "")} />
              </button>
              {isSectionOpen("navigation") ? (
                <div className="space-y-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasStoreAccess ? (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("store-settings")}
                className="flex w-full items-center justify-between px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>Store Settings</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isSectionOpen("store-settings") ? "rotate-180" : "")} />
              </button>
              {isSectionOpen("store-settings") ? (
                <div className="space-y-1 pl-2">
                  {storeSettingsLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasStoreAccess ? (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("content-studio")}
                className="flex w-full items-center justify-between px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>Content Studio</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isSectionOpen("content-studio") ? "rotate-180" : "")} />
              </button>
              {isSectionOpen("content-studio") ? (
                <div className="space-y-1 pl-2">
                  {contentStudioLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasStoreAccess ? (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("marketing")}
                className="flex w-full items-center justify-between px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>Marketing</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isSectionOpen("marketing") ? "rotate-180" : "")} />
              </button>
              {isSectionOpen("marketing") ? (
                <div className="space-y-1 pl-2">
                  {marketingLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {canAccessPlatform ? (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("platform")}
                className="flex w-full items-center justify-between px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>Platform</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isSectionOpen("platform") ? "rotate-180" : "")} />
              </button>
              {isSectionOpen("platform") ? (
                <div className="space-y-1 pl-2">
                  <Link
                    href="/dashboard/platform"
                    className={cn(buttonVariants({ variant: isLinkActive("/dashboard/platform") ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                  >
                    Platform Console
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-border pt-3 lg:mt-3 lg:shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="h-auto w-full justify-between px-2 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold">
                  {initials}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-medium">{accountName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{accountEmail}</span>
                </span>
              </span>
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/account">Profile & Account</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
