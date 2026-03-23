/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontStudioPreviewViewport } from "@/components/dashboard/storefront-studio-preview-viewport";

describe("StorefrontStudioPreviewViewport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.dataset.storefrontThemeActive = "true";
    document.body.dataset.storefrontSlug = "apothecary";
    document.body.style.setProperty("--storefront-primary", "#112233");
  });

  afterEach(() => {
    cleanup();
    delete document.body.dataset.storefrontThemeActive;
    delete document.body.dataset.storefrontSlug;
    document.body.style.removeProperty("--storefront-primary");
  });

  test("renders children into a real iframe viewport and mirrors storefront body attributes", async () => {
    render(
      <StorefrontStudioPreviewViewport title="Mobile preview" widthPx={390}>
        <div>Preview content</div>
      </StorefrontStudioPreviewViewport>
    );

    const iframe = screen.getByTitle("Mobile preview") as HTMLIFrameElement;
    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      value: iframe.contentDocument ?? document.implementation.createHTMLDocument("preview")
    });
    iframe.contentDocument!.body.innerHTML = '<div id="storefront-studio-preview-root"></div>';

    iframe.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(iframe.contentDocument?.body.textContent).toContain("Preview content");
    });

    expect(iframe.style.width).toBe("390px");
    expect(iframe.contentDocument?.body.dataset.storefrontThemeActive).toBe("true");
    expect(iframe.contentDocument?.body.dataset.storefrontSlug).toBe("apothecary");
    expect(iframe.contentDocument?.body.style.getPropertyValue("--storefront-primary")).toBe("#112233");
  });
});
