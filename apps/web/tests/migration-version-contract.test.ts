import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Supabase migration version contract", () => {
  it("assigns every migration a unique monotonically sortable version", () => {
    const files = readdirSync(resolve(repoRoot, "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const versions = files.map((file) => file.split("_", 1)[0]);

    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toEqual([...versions].sort());
  });
});
