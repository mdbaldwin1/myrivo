/** @vitest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    priority,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { src: string; alt: string; priority?: boolean }) => {
    void priority;
    return <span role="img" aria-label={alt} data-src={src} {...props} />;
  }
}));

describe("AuthSplitLayout", () => {
  test("renders the stacked logo, marketing copy, highlights, and page content", () => {
    render(
      <AuthSplitLayout
        eyebrow="Start selling"
        title="Create your Myrivo account."
        description="Set up your account and launch from one connected workspace."
        highlights={["Branded storefront", "Order operations"]}
      >
        <div>Auth form goes here</div>
      </AuthSplitLayout>
    );

    expect(screen.getByRole("img", { name: "Myrivo" }).getAttribute("data-src")).toBe("/brand/myrivo-logo-stacked.svg");
    expect(screen.getByText("Create your Myrivo account.")).toBeTruthy();
    expect(screen.getByText("Set up your account and launch from one connected workspace.")).toBeTruthy();
    expect(screen.getByText("Branded storefront")).toBeTruthy();
    expect(screen.getByText("Order operations")).toBeTruthy();
    expect(screen.getByText("Auth form goes here")).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to site/i }).getAttribute("href")).toBe("/");
  });
});
