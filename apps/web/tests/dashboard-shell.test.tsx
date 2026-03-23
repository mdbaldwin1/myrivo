/* eslint-disable @next/next/no-img-element */
/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

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

vi.mock("@/components/dashboard/dashboard-header-back-button", () => ({
  DashboardHeaderBackButton: () => <div>Back button</div>
}));

vi.mock("@/components/dashboard/dashboard-header-notifications", () => ({
  DashboardHeaderNotifications: () => <div>Notifications</div>
}));

vi.mock("@/components/dashboard/dashboard-header-storefront-link", () => ({
  DashboardHeaderStorefrontLink: () => <div>Storefront link</div>
}));

vi.mock("@/components/dashboard/dashboard-header-store-section", () => ({
  DashboardHeaderStoreSection: () => <div>Store section</div>
}));

vi.mock("@/components/dashboard/dashboard-mobile-nav-sheet", () => ({
  DashboardMobileNavSheet: () => <div>Mobile nav</div>
}));

vi.mock("@/components/dashboard/dashboard-nav", () => ({
  DashboardNav: () => <div>Sidebar nav</div>
}));

vi.mock("@/components/dashboard/use-local-storage-flag", () => ({
  useLocalStorageFlag: () => false,
  writeLocalStorageFlag: vi.fn()
}));

describe("DashboardShell", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test("hides dashboard chrome on onboarding routes", () => {
    usePathnameMock.mockReturnValue("/dashboard/stores/margies-flower-shop/onboarding");

    render(
      <DashboardShell
        activeStoreSlug="margies-flower-shop"
        stores={[]}
        globalRole="admin"
        initialNotificationSoundEnabled={false}
        analyticsDashboardEnabled={false}
        hasStoreAccess
        storeStatus="draft"
        storeOnboardingProgress={null}
      >
        <div>Onboarding content</div>
      </DashboardShell>
    );

    expect(screen.getByText("Onboarding content")).toBeTruthy();
    expect(screen.queryByText("Docs")).toBeNull();
    expect(screen.queryByText("Sidebar nav")).toBeNull();
    expect(screen.queryByText("Store section")).toBeNull();
  });
});
