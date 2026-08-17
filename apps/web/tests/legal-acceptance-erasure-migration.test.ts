import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const migration = readFileSync(
  join(repoRoot, "supabase/migrations/20260817200000_allow_account_erasure_with_legal_record.sql"),
  "utf8",
);

/**
 * The consent record must outlive the account it belonged to: erasing a user
 * severs the link and nothing else. Deleting an account was impossible before
 * this migration, because the cascade collided with the immutability trigger.
 */
describe("legal acceptance account erasure contract", () => {
  it("keeps the acceptance row when its user is erased instead of cascading", () => {
    expect(migration).toContain("alter column user_id drop not null");
    expect(migration).toMatch(/references auth\.users\(id\) on delete set null/);
    expect(migration).not.toMatch(/references auth\.users\(id\) on delete cascade/);
  });

  it("still refuses every deletion", () => {
    expect(migration).toMatch(/if tg_op = 'DELETE' then\s+raise exception 'legal_acceptances rows are immutable once written'/);
  });

  it("permits only the subject link to be severed, never the recorded content", () => {
    // The one allowed transition.
    expect(migration).toMatch(/old\.user_id is not null\s+and new\.user_id is null/);
    // Every other column has to match what was written.
    for (const column of [
      "id",
      "legal_document_id",
      "legal_document_version_id",
      "store_id",
      "accepted_at",
      "acceptance_surface",
      "ip_hash",
      "user_agent",
      "metadata_json",
      "created_at",
    ]) {
      expect(migration).toContain(`new.${column} is not distinct from old.${column}`);
    }
    // Anything else still raises.
    expect(migration.match(/raise exception 'legal_acceptances rows are immutable once written'/g)?.length).toBe(2);
  });
});
