import { describe, expect, it } from "vitest";
import { buildStorefrontStudioDigitalScenario } from "@/lib/store-editor/storefront-studio-digital-scenarios";

describe("Storefront Studio digital scenarios", () => {
  it.each(["digitalOnly", "mixed"] as const)("builds a %s product, cart, and order fixture", (id) => {
    const scenario = buildStorefrontStudioDigitalScenario(id);
    expect(scenario.products.some((product) => product.product_type === "digital")).toBe(true);
    expect(scenario.cartItems.some((item) => item.productType === "digital")).toBe(true);
    expect(scenario.orderSummary.composition).toBe(id === "digitalOnly" ? "digital_only" : "mixed");
    expect(JSON.stringify(scenario)).not.toMatch(/token|storagePath|signedUrl/i);
  });
});
