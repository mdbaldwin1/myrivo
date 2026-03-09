"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BadgePercent,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cog,
  FileText,
  Globe,
  Home,
  Info,
  LayoutDashboard,
  Bell,
  LogOut,
  Mail,
  Package,
  Paintbrush,
  Plug,
  ReceiptText,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Store,
  Truck,
  UserCircle2,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import { AppAlert } from "@/components/ui/app-alert";
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
import { withReturnTo } from "@/lib/auth/return-to";
import { storeSettingsWorkspaceGroups } from "@/lib/store-editor/store-settings-workspace";
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

const contentWorkspaceLinks = [
  { href: "/content-workspace", label: "Studio", icon: Settings },
  { href: "/content-workspace/home", label: "Home Page", icon: Home },
  { href: "/content-workspace/products", label: "Products Page", icon: Package },
  { href: "/content-workspace/about", label: "About Page", icon: Info },
  { href: "/content-workspace/policies", label: "Policies Page", icon: Shield },
  { href: "/content-workspace/cart", label: "Cart Page", icon: ShoppingCart },
  { href: "/content-workspace/order-summary", label: "Order Summary", icon: ClipboardList },
  { href: "/content-workspace/emails", label: "Emails", icon: Mail }
] as const;

const reportsLinks = [
  { href: "/reports/insights", label: "Insights", icon: BarChart3 },
  { href: "/reports/inventory", label: "Inventory Ledger", icon: Package },
  { href: "/reports/billing", label: "Billing Events", icon: ReceiptText }
] as const;

type DashboardNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

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
  const isStoreWorkspaceRoute = Boolean(
    activeStoreSlug &&
      (normalizedPath === `/dashboard/stores/${activeStoreSlug}` || normalizedPath.startsWith(`/dashboard/stores/${activeStoreSlug}/`))
  );
  const canAccessPlatform = globalRole === "support" || globalRole === "admin";
  const [testModeEnabled, setTestModeEnabled] = useState(initialTestModeEnabled);
  const [testModeSaving, setTestModeSaving] = useState(false);
  const [testModeError, setTestModeError] = useState<string | null>(null);
  const initials = getInitials(userDisplayName, userEmail);
  const accountName = userDisplayName?.trim() || "My Account";
  const accountEmail = userEmail?.trim() || "No email";
  const accountReturnTo = pathname || "/dashboard";

  const isLinkActive = (href: string) => {
    const normalizedHref = href.replace(/\/$/, "");
    const isExactOnlyLink = normalizedHref === "/dashboard" || normalizedHref === storeWorkspaceBaseHref || normalizedHref === "/dashboard/admin";
    return isExactOnlyLink
      ? normalizedPath === normalizedHref
      : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
  };

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  const storeWorkspaceBaseHref = activeStoreSlug ? `/dashboard/stores/${activeStoreSlug}` : "/dashboard/stores";
  const accountLevelLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/stores", label: "Store Hub", icon: Store }
  ];
  const adminWorkspaceLinks: DashboardNavLink[] = [
    { href: "/dashboard/admin", label: "Admin Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/admin/stores", label: "Store Governance", icon: Store },
    { href: "/dashboard/admin/moderation", label: "Moderation", icon: ClipboardList },
    { href: "/dashboard/admin/audit", label: "Audit Explorer", icon: Shield },
    { href: "/dashboard/admin/legal", label: "Legal Governance", icon: FileText }
  ];

  const storeWorkspaceLinks: DashboardNavLink[] = [
    { href: `${storeWorkspaceBaseHref}`, label: "Store Overview", icon: LayoutDashboard },
    { href: `${storeWorkspaceBaseHref}/catalog`, label: "Catalog", icon: Package },
    { href: `${storeWorkspaceBaseHref}/orders`, label: "Orders", icon: ReceiptText },
    { href: `${storeWorkspaceBaseHref}/reviews`, label: "Reviews", icon: Star },
    { href: `${storeWorkspaceBaseHref}/notifications`, label: "Notifications", icon: Bell },
    { href: `${storeWorkspaceBaseHref}/promotions`, label: "Promotions", icon: BadgePercent },
    { href: `${storeWorkspaceBaseHref}/subscribers`, label: "Subscribers", icon: Mail },
    { href: `${storeWorkspaceBaseHref}/content-workspace`, label: "Content", icon: Home },
    { href: `${storeWorkspaceBaseHref}/reports`, label: "Reports", icon: BarChart3 },
    { href: `${storeWorkspaceBaseHref}/store-settings`, label: "Settings", icon: Cog }
  ];
  const subWorkspaceEntryHrefs = new Set([
    `${storeWorkspaceBaseHref}/content-workspace`,
    `${storeWorkspaceBaseHref}/reports`,
    `${storeWorkspaceBaseHref}/store-settings`
  ]);

  const storeSettingsLinkGroups = storeSettingsWorkspaceGroups.map((group) => ({
    ...group,
    sections: group.sections.map((link) => ({
      ...link,
      href: `${storeWorkspaceBaseHref}${link.href}`
    }))
  }));
  const contentWorkspaceWorkspaceLinks: DashboardNavLink[] = contentWorkspaceLinks.map((link) => ({
    ...link,
    href: `${storeWorkspaceBaseHref}${link.href}`
  }));
  const reportsWorkspaceLinks: DashboardNavLink[] = reportsLinks.map((link) => ({
    ...link,
    href: `${storeWorkspaceBaseHref}${link.href}`
  }));

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

  const isContentWorkspaceMode =
    normalizedPath === `${storeWorkspaceBaseHref}/content-workspace` ||
    normalizedPath.startsWith(`${storeWorkspaceBaseHref}/content-workspace/`);
  const isStoreSettingsMode =
    normalizedPath === `${storeWorkspaceBaseHref}/store-settings` || normalizedPath.startsWith(`${storeWorkspaceBaseHref}/store-settings/`);
  const isReportsMode = normalizedPath === `${storeWorkspaceBaseHref}/reports` || normalizedPath.startsWith(`${storeWorkspaceBaseHref}/reports/`);
  const isAdminWorkspaceMode = normalizedPath === "/dashboard/admin" || normalizedPath.startsWith("/dashboard/admin/");

  return (
    <nav className={cn("h-full min-h-0 flex flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {canAccessPlatform && isAdminWorkspaceMode ? (
            <div className="space-y-1">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Admin Workspace</p>
              {adminWorkspaceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={isLinkActive(link.href) ? "page" : undefined}
                  className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                >
                  <span className="flex items-center gap-2">
                    <link.icon className="h-4 w-4 shrink-0" />
                    <span>{link.label}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}

          {hasStoreAccess && isStoreWorkspaceRoute && !isAdminWorkspaceMode ? (
            <div>
              {isContentWorkspaceMode ? (
                <div className="space-y-1">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Content Workspace</p>
                  {contentWorkspaceWorkspaceLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={isLinkActive(link.href) ? "page" : undefined}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      <span className="flex items-center gap-2">
                        <link.icon className="h-4 w-4 shrink-0" />
                        <span>{link.label}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : isStoreSettingsMode ? (
                <div className="space-y-1">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Settings Workspace</p>
                  {storeSettingsLinkGroups.map((group) => (
                    <div key={group.id} className="space-y-1">
                      <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">{group.title}</p>
                      {group.sections.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={onNavigate}
                          aria-current={isLinkActive(link.href) ? "page" : undefined}
                          className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                        >
                          <span className="flex items-center gap-2">
                            <link.icon className="h-4 w-4 shrink-0" />
                            <span>{link.label}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ) : isReportsMode ? (
                <div className="space-y-1">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reports Workspace</p>
                  {reportsWorkspaceLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={isLinkActive(link.href) ? "page" : undefined}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      <span className="flex items-center gap-2">
                        <link.icon className="h-4 w-4 shrink-0" />
                        <span>{link.label}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Store Workspace
                  </p>
                  {storeWorkspaceLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={isLinkActive(link.href) ? "page" : undefined}
                      className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <link.icon className="h-4 w-4 shrink-0" />
                          <span>{link.label}</span>
                        </span>
                        {subWorkspaceEntryHrefs.has(link.href) ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {hasStoreAccess && !isStoreWorkspaceRoute && !isAdminWorkspaceMode ? (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Myrivo Workspace</p>
              <div className="space-y-1">
                {accountLevelLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={isLinkActive(link.href) ? "page" : undefined}
                    className={cn(buttonVariants({ variant: isLinkActive(link.href) ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                  >
                    <span className="flex items-center gap-2">
                      <link.icon className="h-4 w-4 shrink-0" />
                      <span>{link.label}</span>
                    </span>
                  </Link>
                ))}
                {canAccessPlatform ? (
                  <Link
                    href="/dashboard/admin"
                    onClick={onNavigate}
                    aria-current={isLinkActive("/dashboard/admin") ? "page" : undefined}
                    className={cn(buttonVariants({ variant: isLinkActive("/dashboard/admin") ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      <span>Admin Workspace</span>
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {!hasStoreAccess && !isAdminWorkspaceMode && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Myrivo Workspace</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  onClick={onNavigate}
                  aria-current={isLinkActive("/dashboard") ? "page" : undefined}
                  className={cn(buttonVariants({ variant: isLinkActive("/dashboard") ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                >
                  <span className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>Dashboard</span>
                  </span>
                </Link>
                {canAccessPlatform ? (
                  <Link
                    href="/dashboard/admin"
                    onClick={onNavigate}
                    aria-current={isLinkActive("/dashboard/admin") ? "page" : undefined}
                    className={cn(buttonVariants({ variant: isLinkActive("/dashboard/admin") ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      <span>Admin Workspace</span>
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 shrink-0 space-y-2 border-t border-border pt-3">
        {hasStoreAccess && isStoreWorkspaceRoute ? (
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
            <AppAlert variant="error" compact className="mt-1 text-[11px]" message={testModeError} />
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
              <Link href={withReturnTo("/profile", accountReturnTo)} onClick={onNavigate}>
                <UserCircle2 className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={withReturnTo("/notifications", accountReturnTo)} onClick={onNavigate}>
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={withReturnTo("/settings", accountReturnTo)} onClick={onNavigate}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
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
