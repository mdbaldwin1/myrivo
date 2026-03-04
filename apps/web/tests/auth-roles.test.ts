import { describe, expect, test } from "vitest";
import { hasGlobalRole, hasStoreRole } from "@/lib/auth/roles";

describe("authorization role ordering", () => {
  test("store role ordering enforces customer < staff < admin < owner < support", () => {
    expect(hasStoreRole("customer", "staff")).toBe(false);
    expect(hasStoreRole("staff", "customer")).toBe(true);
    expect(hasStoreRole("admin", "staff")).toBe(true);
    expect(hasStoreRole("owner", "admin")).toBe(true);
    expect(hasStoreRole("support", "owner")).toBe(true);
  });

  test("global role ordering enforces user < support < admin", () => {
    expect(hasGlobalRole("user", "support")).toBe(false);
    expect(hasGlobalRole("support", "user")).toBe(true);
    expect(hasGlobalRole("admin", "support")).toBe(true);
  });
});

