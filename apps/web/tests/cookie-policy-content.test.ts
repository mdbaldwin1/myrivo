import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CookiePolicyContent } from "@/components/privacy/cookie-policy-content";

describe("cookie policy content", () => {
  test("renders the cookie categories and current inventory", () => {
    const markup = renderToStaticMarkup(createElement(CookiePolicyContent, { scopeLabel: "Sunset Mercantile" }));

    expect(markup).toContain("Cookie Policy");
    expect(markup).toContain("Essential cookies");
    expect(markup).toContain("Analytics cookies");
    expect(markup).toContain("Storefront analytics session");
    expect(markup).toContain("Sunset Mercantile");
  });
});
