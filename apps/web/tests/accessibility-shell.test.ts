import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PageShell } from "@/components/layout/page-shell";
import { SkipLink } from "@/components/ui/skip-link";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";

describe("accessibility shell primitives", () => {
  test("renders a skip link targeting the shared main content id", () => {
    const markup = renderToStaticMarkup(createElement(SkipLink));

    expect(markup).toContain(`href="#${MAIN_CONTENT_ID}"`);
    expect(markup).toContain("Skip to main content");
  });

  test("assigns the shared main content id to page-level main content", () => {
    const markup = renderToStaticMarkup(createElement(PageShell, null, createElement("p", null, "Hello")));

    expect(markup).toContain(`<main id="${MAIN_CONTENT_ID}"`);
    expect(markup).toContain('tabindex="-1"');
  });
});
