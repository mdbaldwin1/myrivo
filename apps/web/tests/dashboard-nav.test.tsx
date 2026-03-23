/* eslint-disable @next/next/no-img-element */
/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) => (
    <img src={src} alt={alt} {...props} />
  )
}));

vi.mock("@/components/use-has-mounted", () => ({
  useHasMounted: () => false
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe("DashboardNav", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows store workspace links on a store route even when the store list is temporarily unavailable", () => {
    usePathnameMock.mockReturnValue("/dashboard/stores/margies-flower-shop");

    render(
      <DashboardNav
        activeStoreSlug={null}
        stores={[]}
        globalRole="admin"
        analyticsDashboardEnabled={false}
      />
    );

    expect(screen.getByText("Store Workspace")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Store Overview/i }).getAttribute("href")).toBe("/dashboard/stores/margies-flower-shop");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Admin Workspace" })).toBeNull();
  });
});
