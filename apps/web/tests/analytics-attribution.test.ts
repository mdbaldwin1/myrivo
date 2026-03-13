import { describe, expect, test } from "vitest";
import {
  buildStorefrontAttributionTouch,
  mergeStorefrontAttributionSnapshot,
  readStorefrontAttributionSnapshot,
  writeStorefrontAttributionSnapshot
} from "@/lib/analytics/attribution";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
}

describe("storefront analytics attribution helpers", () => {
  test("normalizes entry path, referrer, and utm params", () => {
    expect(
      buildStorefrontAttributionTouch({
        entryPath: "/s/olive-mercantile?utm_source=instagram&utm_medium=social&utm_campaign=spring",
        referrer: "https://instagram.com/story/123",
        storeSlug: "olive-mercantile"
      })
    ).toMatchObject({
      entryPath: "/s/olive-mercantile?utm_source=instagram&utm_medium=social&utm_campaign=spring",
      referrerHost: "instagram.com",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "spring"
    });
  });

  test("preserves first touch and only updates last touch on new marketing signals", () => {
    const firstTouch = buildStorefrontAttributionTouch({
      entryPath: "/s/olive-mercantile?utm_source=instagram",
      referrer: "https://instagram.com/story/123",
      storeSlug: "olive-mercantile"
    });
    const internalTouch = buildStorefrontAttributionTouch({
      entryPath: "/products/body-oil",
      referrer: "http://localhost:3000/s/olive-mercantile",
      storeSlug: "olive-mercantile"
    });

    const snapshot = mergeStorefrontAttributionSnapshot(null, firstTouch);
    const nextSnapshot = mergeStorefrontAttributionSnapshot(snapshot, internalTouch);

    expect(nextSnapshot.firstTouch).toEqual(firstTouch);
    expect(nextSnapshot.lastTouch).toEqual(firstTouch);
  });

  test("persists attribution snapshots by store", () => {
    const storage = createMemoryStorage();
    writeStorefrontAttributionSnapshot(
      "olive-mercantile",
      {
        firstTouch: { entryPath: "/s/olive-mercantile?utm_source=instagram", utmSource: "instagram" }
      },
      storage
    );

    expect(readStorefrontAttributionSnapshot("olive-mercantile", storage)).toMatchObject({
      firstTouch: { utmSource: "instagram" }
    });
  });
});
