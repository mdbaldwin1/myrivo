import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import StorefrontLoading from "@/app/s/[slug]/loading";
import { OverviewLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeletons";

describe("reduced motion support", () => {
  test("dashboard skeleton blocks disable pulse animation for reduced-motion users", () => {
    const markup = renderToStaticMarkup(createElement(OverviewLoadingSkeleton));

    expect(markup).toContain("motion-reduce:animate-none");
  });

  test("storefront loading placeholders disable pulse animation for reduced-motion users", () => {
    const markup = renderToStaticMarkup(createElement(StorefrontLoading));

    expect(markup).toContain("motion-reduce:animate-none");
  });
});
