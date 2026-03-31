import { describe, expect, test } from "vitest";
import { resolveAvailableValuesForOption } from "@/components/storefront/storefront-product-detail-page";

describe("storefront product detail option availability", () => {
  test("keeps top-level option values available even when a lower-level selection is archived away", () => {
    const variants = [
      {
        id: "a",
        title: "Lavender • 2 oz",
        image_urls: [],
        group_image_urls: [],
        option_values: { Scent: "Lavender", Size: "2 oz" },
        price_cents: 1200,
        inventory_qty: 3,
        is_made_to_order: false,
        is_default: true,
        status: "active" as const,
        sort_order: 0,
        created_at: "2026-03-31T00:00:00.000Z"
      },
      {
        id: "b",
        title: "Unscented • 4 oz",
        image_urls: [],
        group_image_urls: [],
        option_values: { Scent: "Unscented", Size: "4 oz" },
        price_cents: 2200,
        inventory_qty: 5,
        is_made_to_order: false,
        is_default: false,
        status: "active" as const,
        sort_order: 1,
        created_at: "2026-03-31T00:00:00.000Z"
      }
    ];

    const values = resolveAvailableValuesForOption(variants, ["Scent", "Size"], { Size: "2 oz" }, "Scent");

    expect(values).toEqual(["Lavender", "Unscented"]);
  });
});
