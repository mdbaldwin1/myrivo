/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MarketingMobileNavSheet } from "@/components/marketing/marketing-mobile-nav-sheet";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/components/ui/sheet", () => {
  const SheetContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void } | null>(null);

  function Sheet({
    open,
    onOpenChange,
    children
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) {
    return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>;
  }

  function SheetTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) {
    const context = React.useContext(SheetContext);
    if (!context) {
      return children;
    }

    if (!asChild) {
      return <button type="button" onClick={() => context.onOpenChange(true)}>{children}</button>;
    }

    const child = children as React.ReactElement<{ onClick?: (...args: unknown[]) => void }>;

    return React.cloneElement(child, {
      onClick: (...args: unknown[]) => {
        child.props.onClick?.(...args);
        context.onOpenChange(true);
      }
    });
  }

  function SheetContent({ children }: { children: React.ReactNode }) {
    const context = React.useContext(SheetContext);
    if (!context?.open) {
      return null;
    }
    return <div>{children}</div>;
  }

  function SheetHeader({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  function SheetTitle({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  function SheetDescription({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  return { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
});

describe("MarketingMobileNavSheet", () => {
  const navItems = [
    { href: "/features" as const, label: "Features" },
    { href: "/pricing" as const, label: "Pricing" },
    { href: "/compare" as const, label: "Compare" },
    { href: "/for" as const, label: "Solutions" }
  ];

  afterEach(() => {
    cleanup();
  });

  test("shows public pages plus sign-in actions for signed-out visitors", async () => {
    const user = userEvent.setup();

    render(<MarketingMobileNavSheet activePath="/pricing" navItems={navItems} />);

    await user.click(screen.getByLabelText("Open site navigation menu"));

    expect(screen.getByText("Site navigation")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Features" }).getAttribute("href")).toBe("/features");
    expect(screen.getByRole("link", { name: "Pricing" }).getAttribute("href")).toBe("/pricing");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?returnTo=%2Fpricing");
    expect(screen.getByRole("link", { name: "Start free" }).getAttribute("href")).toBe("/signup");
  });

  test("shows dashboard and profile actions for signed-in visitors", async () => {
    const user = userEvent.setup();

    render(<MarketingMobileNavSheet activePath="/" isAuthenticated navItems={navItems} />);

    await user.click(screen.getByLabelText("Open site navigation menu"));

    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile");
  });
});
