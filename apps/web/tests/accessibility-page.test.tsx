import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import AccessibilityPage from "@/app/accessibility/page";

describe("accessibility statement page", () => {
  test("renders the public accessibility statement and support path", () => {
    const markup = renderToStaticMarkup(createElement(AccessibilityPage));

    expect(markup).toContain("Accessibility Statement");
    expect(markup).toContain("Need help or found a barrier?");
    expect(markup).toContain("Current evidence model");
    expect(markup).toContain("storefront browse-to-buy and product discovery");
    expect(markup).toContain("Submit accessibility report");
    expect(markup).toContain("mailto:hello@myrivo.app?subject=Myrivo%20Accessibility%20Support");
    expect(markup).toContain("formal WCAG conformance claim");
  });
});
