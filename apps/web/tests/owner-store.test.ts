import { describe, expect, test } from "vitest";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";

describe("owner store relation fallback", () => {
  test("returns true for PostgREST missing relation code", () => {
    expect(isMissingRelationInSchemaCache({ code: "PGRST205", message: "any" })).toBe(true);
  });

  test("returns true for schema cache table missing message", () => {
    expect(
      isMissingRelationInSchemaCache({
        message: "Could not find the table 'public.store_settings' in the schema cache"
      })
    ).toBe(true);
  });

  test("returns false for unrelated query errors", () => {
    expect(isMissingRelationInSchemaCache({ code: "42501", message: "permission denied" })).toBe(false);
  });

  test("returns false for null input", () => {
    expect(isMissingRelationInSchemaCache(null)).toBe(false);
  });
});
