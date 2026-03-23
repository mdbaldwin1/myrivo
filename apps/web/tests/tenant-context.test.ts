import { describe, expect, test } from "vitest";
import { resolveActiveStoreForRole, resolveActiveStoreFromList, type AccessibleStore } from "@/lib/stores/tenant-context";

function makeStore(slug: string, role: AccessibleStore["role"] = "owner"): AccessibleStore {
  return {
    id: `store-${slug}`,
    name: `Store ${slug}`,
    slug,
    status: "live",
    has_launched_once: true,
    stripe_account_id: null,
    role,
    permissions_json: {}
  };
}

describe("tenant context store selection", () => {
  test("returns null when no stores are available", () => {
    expect(resolveActiveStoreFromList([], "curby")).toBeNull();
  });

  test("selects preferred store when available", () => {
    const selected = resolveActiveStoreFromList([makeStore("curby"), makeStore("sister-store")], "sister-store");
    expect(selected?.slug).toBe("sister-store");
  });

  test("falls back to first available store when preferred is unavailable", () => {
    const selected = resolveActiveStoreFromList([makeStore("curby"), makeStore("sister-store")], "unknown");
    expect(selected?.slug).toBe("curby");
  });

  test("falls back to the first store that satisfies the required role", () => {
    const selected = resolveActiveStoreForRole(
      [makeStore("customer-store", "customer"), makeStore("staff-store", "staff"), makeStore("owner-store", "owner")],
      "staff",
      "customer-store"
    );

    expect(selected?.slug).toBe("staff-store");
  });

  test("keeps the preferred store when it satisfies the required role", () => {
    const selected = resolveActiveStoreForRole(
      [makeStore("customer-store", "customer"), makeStore("staff-store", "staff"), makeStore("owner-store", "owner")],
      "staff",
      "owner-store"
    );

    expect(selected?.slug).toBe("owner-store");
  });
});
