import { describe, expect, test, vi } from "vitest";
import { getPendingSignupLegalVersionIds, recordPendingSignupLegalAcceptances } from "@/lib/legal/consent";

describe("legal consent helpers", () => {
  test("extracts pending signup legal version ids from user metadata", () => {
    expect(
      getPendingSignupLegalVersionIds({
        signup_legal_version_ids: ["a", "b", 123, null]
      })
    ).toEqual(["a", "b"]);
  });

  test("records pending signup legal acceptances when signup metadata is present", async () => {
    const insertMock = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "legal_document_versions") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    data: [{ id: "version-1", legal_document_id: "doc-1" }],
                    error: null
                  }))
                }))
              }))
            }))
          };
        }

        if (table === "legal_acceptances") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({ data: [], error: null }))
              }))
            })),
            insert: insertMock
          };
        }

        throw new Error(`Unexpected table ${table}`);
      })
    } as const;

    await recordPendingSignupLegalAcceptances(supabase as never, {
      userId: "user-1",
      userMetadata: {
        signup_legal_version_ids: ["version-1"]
      }
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
