/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: React.HTMLAttributes<HTMLSpanElement> & { src: string; alt: string }) => (
    <span role="img" aria-label={alt} data-src={src} {...props} />
  )
}));

vi.mock("@/components/marketing/marketing-analytics-provider", () => ({
  MarketingAnalyticsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/components/marketing/marketing-tracked-button-link", () => ({
  MarketingTrackedButtonLink: ({
    href,
    children,
    className
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

vi.mock("@/components/privacy/cookie-preferences-button", () => ({
  CookiePreferencesButton: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  )
}));

describe("MarketingSiteChrome", () => {
  afterEach(() => {
    cleanup();
  });

  test("uses a stable viewport shell and keeps the shared sticky header structure", () => {
    const { container } = render(
      <MarketingSiteChrome activePath="/pricing">
        <p>Pricing content</p>
      </MarketingSiteChrome>
    );

    const shell = container.firstElementChild as HTMLElement | null;
    const header = container.querySelector("header");
    const main = container.querySelector("main");

    expect(shell).not.toBeNull();
    expect(shell?.className).toContain("min-h-[100svh]");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(main?.getAttribute("id")).toBe(MAIN_CONTENT_ID);
  });
});
