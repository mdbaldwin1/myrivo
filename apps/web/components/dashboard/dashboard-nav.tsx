"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LayoutGrid, LogOut, UserCircle2 } from "lucide-react";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { GlobalUserRole } from "@/types/database";

type DashboardNavProps = {
  activeStoreSlug: string | null;
  stores: StoreOption[];
  globalRole: GlobalUserRole;
  userDisplayName?: string | null;
  userEmail?: string | null;
  userAvatarPath?: string | null;
  initialTestModeEnabled: boolean;
  canManageTestMode: boolean;
  mode?: "desktop" | "mobile";
  className?: string;
  onNavigate?: () => void;
};

const globalLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/catalog", label: "Catalog" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/marketing/promotions", label: "Promotions" },
  { href: "/dashboard/marketing/subscribers", label: "Email Subscribers" },
  { href: "/dashboard/content-studio", label: "Content Studio" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/store-settings", label: "Store Settings" }
];

const storeSettingsLinks = [
  { href: "/dashboard/store-settings/profile", label: "General" },
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

const reportsLinks = [
  { href: "/dashboard/reports/insights", label: "Insights" },
  { href: "/dashboard/reports/inventory", label: "Inventory Ledger" },
  { href: "/dashboard/reports/billing", label: "Billing Events" }
] as const;

function getInitials(name: string | null | undefined, email: string | null | undefined) {
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

export function DashboardNav({
  activeStoreSlug,
  stores,
  globalRole,
  userDisplayName,
  userEmail,
  userAvatarPath,
  initialTestModeEnabled,
  canManageTestMode,
  className,
  onNavigate
}: DashboardNavProps) {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, "") ?? "";
  const hasStoreAccess = stores.length > 0 && Boolean(activeStoreSlug);
  const canAccessPlatform = globalRole === "support" || globalRole === "admin";
  const [testModeEnabled, setTestModeEnabled] = useState(initialTestModeEnabled);
  const [testModeSaving, setTestModeSaving] = useState(false);
  const [testModeError, setTestModeError] = useState<string | null>(null);
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

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  async function toggleTestMode() {
    if (!canManageTestMode || testModeSaving) {
      return;
    }

    const nextValue = !testModeEnabled;
    setTestModeSaving(true);
    setTestModeError(null);

    const response = await fetch("/api/stores/test-mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextValue })
    });
    const payload = (await response.json()) as { enabled?: boolean; error?: string };
    if (!response.ok) {
      setTestModeError(payload.error ?? "Unable to update test mode.");
      setTestModeSaving(false);
      return;
    }

    setTestModeEnabled(Boolean(payload.enabled));
    setTestModeSaving(false);
  }

  const isContentStudioMode =
    normalizedPath === "/dashboard/content-studio" || normalizedPath.startsWith("/dashboard/content-studio/");
  const isStoreSettingsMode =
    normalizedPath === "/dashboard/store-settings" || normalizedPath.startsWith("/dashboard/store-settings/");
  const isReportsMode = normalizedPath === "/dashboard/reports" || normalizedPath.startsWith("/dashboard/reports/");
  const activeWorkspaceLinks = isContentStudioMode
    ? { title: "Content Studio", links: contentStudioLinks }
    : isStoreSettingsMode
      ? { title: "Store Settings", links: storeSettingsLinks }
      : isReportsMode
        ? { title: "Reports", links: reportsLinks }
        : null;

  return (
    <nav className={cn("h-full min-h-0 flex flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {hasStoreAccess ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Navigation</p>
                {globalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={isLinkActive(link.href) ? "page" : undefined}
                    className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {activeWorkspaceLinks ? (
                <div className="space-y-1 border-t border-border/70 pt-3">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {activeWorkspaceLinks.title}
                  </p>
                  {activeWorkspaceLinks.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={isLinkActive(link.href) ? "page" : undefined}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}

              {canAccessPlatform ? (
                <div className="space-y-1 border-t border-border/70 pt-3">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform</p>
                  <Link
                    href="/dashboard/platform"
                    onClick={onNavigate}
                    aria-current={isLinkActive("/dashboard/platform") ? "page" : undefined}
                    className={cn(
                      buttonVariants({ variant: isLinkActive("/dashboard/platform") ? "default" : "ghost", size: "sm" }),
                      "w-full justify-start"
                    )}
                  >
                    Platform Console
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {!hasStoreAccess && canAccessPlatform ? (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/platform"
                  onClick={onNavigate}
                  aria-current={isLinkActive("/dashboard/platform") ? "page" : undefined}
                  className={cn(buttonVariants({ variant: isLinkActive("/dashboard/platform") ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                >
                  Platform Console
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 shrink-0 space-y-2 border-t border-border pt-3">
        {hasStoreAccess ? (
          <div className="rounded-md border border-border/70 bg-background/70 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Test Mode</p>
              <Switch
                checked={testModeEnabled}
                onChange={(event) => {
                  if (event.target.checked !== testModeEnabled) {
                    void toggleTestMode();
                  }
                }}
                disabled={!canManageTestMode || testModeSaving}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {canManageTestMode
                ? "Routes checkout through test credentials for this store."
                : "Only billing admins can change this setting."}
            </p>
            {testModeError ? <p className="mt-1 text-[11px] text-red-600">{testModeError}</p> : null}
          </div>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-md border border-transparent px-2 py-2 hover:border-border/60">
              <span className="flex min-w-0 items-center gap-2">
                {userAvatarPath ? (
                  <Image
                    src={userAvatarPath}
                    alt="User avatar"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold">
                    {initials}
                  </span>
                )}
                <span className="min-w-0 text-left">
                  <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">My Account</span>
                  <span className="block truncate text-sm font-medium">{accountName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{accountEmail}</span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64">
            <DropdownMenuLabel className="pb-1">
              <p className="truncate text-xs font-medium text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-semibold">{accountEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/account" onClick={onNavigate}>
                <UserCircle2 className="mr-2 h-4 w-4" />
                Profile & Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account" onClick={onNavigate}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Customer Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()} className="text-red-600 focus:text-red-700">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
