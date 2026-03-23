import { describe, expect, test } from "vitest";
import { areEditorValuesEqual, getEditorValueAtPath, setEditorValueAtPath } from "@/lib/store-editor/object-path";

describe("store editor object path helpers", () => {
  test("reads nested values by dotted path", () => {
    expect(
      getEditorValueAtPath(
        {
          seo: { location: { city: "Brooklyn" } }
        },
        "seo.location.city"
      )
    ).toBe("Brooklyn");
  });

  test("writes nested values without mutating the original object", () => {
    const original = {
      seo: { location: { city: "Brooklyn" } }
    };

    const updated = setEditorValueAtPath(original, "seo.location.region", "NYC metro");

    expect(updated).toEqual({
      seo: { location: { city: "Brooklyn", region: "NYC metro" } }
    });
    expect(original).toEqual({
      seo: { location: { city: "Brooklyn" } }
    });
  });

  test("compares editor values structurally", () => {
    expect(areEditorValuesEqual({ a: 1, nested: { b: true } }, { a: 1, nested: { b: true } })).toBe(true);
    expect(areEditorValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});
