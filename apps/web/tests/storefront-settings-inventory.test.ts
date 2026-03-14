import { describe, expect, test } from "vitest";
import { STOREFRONT_SETTINGS_INVENTORY, STOREFRONT_SETTINGS_STRANDED_IDS } from "@/lib/storefront/settings-inventory";

describe("storefront settings inventory", () => {
  test("does not leave storefront-facing settings stranded after consolidation", () => {
    expect(STOREFRONT_SETTINGS_STRANDED_IDS).toEqual([]);
  });

  test("keeps restored browser and presentation controls mapped to intentional homes", () => {
    const inventoryById = Object.fromEntries(STOREFRONT_SETTINGS_INVENTORY.map((item) => [item.id, item]));

    expect(inventoryById["branding.appleTouchIconPath"]).toMatchObject({
      targetHome: "general",
      status: "active",
      disposition: "editable"
    });
    expect(inventoryById["branding.ogImagePath"]).toMatchObject({
      targetHome: "general",
      status: "active",
      disposition: "editable"
    });
    expect(inventoryById["branding.twitterImagePath"]).toMatchObject({
      targetHome: "general",
      status: "active",
      disposition: "editable"
    });

    expect(inventoryById["theme.heroBrandDisplay"]).toMatchObject({
      targetHome: "storefront_studio",
      status: "active",
      disposition: "editable"
    });
    expect(inventoryById["theme.homeFeaturedProductsLimit"]).toMatchObject({
      targetHome: "storefront_studio",
      status: "active",
      disposition: "editable"
    });
    expect(inventoryById["theme.catalogLayout"]).toMatchObject({
      targetHome: "storefront_studio",
      status: "active",
      disposition: "editable"
    });
    expect(inventoryById["theme.productCardBehavior"]).toMatchObject({
      targetHome: "storefront_studio",
      status: "active",
      disposition: "editable"
    });
    expect(inventoryById["theme.reviewsGlobal"]).toMatchObject({
      targetHome: "storefront_studio",
      status: "active",
      disposition: "editable"
    });
  });

  test("confines retired legacy theme fields to explicit retirement entries", () => {
    const retiredIds = STOREFRONT_SETTINGS_INVENTORY.filter((item) => item.disposition === "retire").map((item) => item.id);
    expect(retiredIds).toEqual(["theme.buttonStyle", "theme.fontPreset"]);
  });
});
