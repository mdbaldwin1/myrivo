import { describe, expect, it } from "vitest";
import { hashDigitalAccessToken } from "@/lib/digital-products/entitlements";

describe("digital access tokens", () => {
  it("stores a deterministic SHA-256 digest instead of the bearer token", () => {
    expect(hashDigitalAccessToken("secret-link-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDigitalAccessToken("secret-link-token")).toBe(hashDigitalAccessToken("secret-link-token"));
    expect(hashDigitalAccessToken("secret-link-token")).not.toContain("secret-link-token");
  });
});
