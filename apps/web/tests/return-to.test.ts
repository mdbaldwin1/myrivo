import { describe, expect, test } from "vitest";
import { sanitizeReturnTo, withReturnTo } from "@/lib/auth/return-to";

describe("returnTo helpers", () => {
  test("allows safe relative dashboard paths", () => {
    expect(sanitizeReturnTo("/dashboard/stores/acme/orders")).toBe("/dashboard/stores/acme/orders");
  });

  test("rejects external absolute urls", () => {
    expect(sanitizeReturnTo("https://evil.example/phish")).toBe("/dashboard");
  });

  test("rejects protocol-relative urls", () => {
    expect(sanitizeReturnTo("//evil.example")).toBe("/dashboard");
  });

  test("rejects disallowed paths", () => {
    expect(sanitizeReturnTo("/api/secrets")).toBe("/dashboard");
  });

  test("builds hrefs with safe returnTo", () => {
    expect(withReturnTo("/login", "/s/my-shop/products?store=my-shop")).toBe(
      "/login?returnTo=%2Fs%2Fmy-shop%2Fproducts%3Fstore%3Dmy-shop"
    );
  });

  test("allows legal consent routes", () => {
    expect(sanitizeReturnTo("/legal/consent?returnTo=%2Fdashboard")).toBe("/legal/consent?returnTo=%2Fdashboard");
  });
});
