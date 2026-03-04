import { describe, expect, test } from "vitest";
import { resolveActiveStoreFromList, type AccessibleStore } from "@/lib/stores/tenant-context";

function makeStore(slug: string, role: AccessibleStore["role"] = "owner"): AccessibleStore {
  return {
    id: `store-${slug}`,
    name: `Store ${slug}`,
    slug,
    status: "active",
    stripe_account_id: null,
    role
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
});
