import { describe, expect, test } from "vitest";
import { shouldOpenCatalogProductFromUrl } from "@/lib/dashboard/catalog-url-sync";

describe("shouldOpenCatalogProductFromUrl", () => {
  test("opens when a product id first appears in the URL", () => {
    expect(shouldOpenCatalogProductFromUrl("product-1", null)).toBe(true);
  });

  test("does not reopen when the URL is still pointing at the same product", () => {
    expect(shouldOpenCatalogProductFromUrl("product-1", "product-1")).toBe(false);
  });

  test("opens when the URL changes to a different product", () => {
    expect(shouldOpenCatalogProductFromUrl("product-2", "product-1")).toBe(true);
  });

  test("does not open when there is no product id in the URL", () => {
    expect(shouldOpenCatalogProductFromUrl(null, "product-1")).toBe(false);
  });
});
