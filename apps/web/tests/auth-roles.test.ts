import { describe, expect, test } from "vitest";
import { hasGlobalRole, hasStorePermission, hasStoreRole } from "@/lib/auth/roles";

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

  test("store permissions default to role matrix when no overrides exist", () => {
    expect(hasStorePermission("staff", {}, "store.manage_catalog")).toBe(true);
    expect(hasStorePermission("staff", {}, "store.manage_domains")).toBe(false);
    expect(hasStorePermission("admin", {}, "store.manage_domains")).toBe(true);
  });

  test("store permissions honor explicit overrides before role defaults", () => {
    expect(hasStorePermission("admin", { "store.manage_domains": false }, "store.manage_domains")).toBe(false);
    expect(hasStorePermission("staff", { "store.manage_members": true }, "store.manage_members")).toBe(true);
    expect(hasStorePermission("staff", { "*": false }, "store.manage_catalog")).toBe(false);
  });
});
