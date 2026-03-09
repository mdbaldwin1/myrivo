import { describe, expect, it } from "vitest";
import { buildLegalAcceptancesCsv, parseLegalAdminFilters } from "@/lib/platform/legal-admin";

describe("legal admin helpers", () => {
  it("parses legal filter query params", () => {
    const filters = parseLegalAdminFilters(
      new URLSearchParams({ userEmail: "owner@example.com", storeSlug: "at-home-apothecary", documentKey: "terms", versionLabel: "v1.1" })
    );

    expect(filters).toEqual({
      userEmail: "owner@example.com",
      storeSlug: "at-home-apothecary",
      documentKey: "terms",
      versionLabel: "v1.1"
    });
  });

  it("builds csv with escaped cells", () => {
    const csv = buildLegalAcceptancesCsv([
      {
        id: "a1",
        acceptedAt: "2026-03-09T12:00:00Z",
        acceptanceSurface: "signup",
        userId: "u1",
        userEmail: 'owner+"quote"@example.com',
        storeId: "s1",
        storeSlug: "my-store",
        documentKey: "terms",
        documentTitle: "Terms & Conditions",
        versionLabel: "v1.0"
      }
    ]);

    expect(csv).toContain('"owner+""quote""@example.com"');
    expect(csv.split("\n")[0]).toContain("acceptance_id");
  });
});
