import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";

const TabContainerElement = StorefrontStudioStorefrontEditorPanelTabContainer as unknown as (props: {
  footer?: string;
  children?: ReturnType<typeof createElement>;
}) => ReturnType<typeof createElement>;

const TabSectionElement = StorefrontStudioStorefrontEditorPanelTabSection as unknown as (props: {
  title: string;
  description?: string;
  children?: ReturnType<typeof createElement>;
}) => ReturnType<typeof createElement>;

describe("Storefront Studio editor panel layout", () => {
  test("renders shared tab section heading and footer copy", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TabContainerElement,
        {
          footer: "Changes save automatically."
        },
        createElement(
          TabSectionElement,
          {
            title: "Page links",
            description: "Shared footer navigation."
          },
          createElement("div", null, "content")
        )
      )
    );

    expect(markup).toContain("Page links");
    expect(markup).toContain("Shared footer navigation.");
    expect(markup).toContain("Changes save automatically.");
    expect(markup).toContain("uppercase");
  });
});
