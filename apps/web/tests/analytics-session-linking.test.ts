import { describe, expect, test, vi } from "vitest";
import { resolveStorefrontSessionLink } from "@/lib/analytics/session-linking";

describe("storefront analytics session linking", () => {
  test("returns the storefront session row for a valid store session key", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: "session-row-1" }, error: null }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle
            }))
          }))
        }))
      }))
    };

    await expect(resolveStorefrontSessionLink(supabase, { storeId: "store-1", sessionKey: "analytics_session_1234" })).resolves.toEqual({
      id: "session-row-1",
      sessionKey: "analytics_session_1234"
    });
  });

  test("returns null for invalid session keys", async () => {
    const supabase = {
      from: vi.fn()
    };

    await expect(resolveStorefrontSessionLink(supabase, { storeId: "store-1", sessionKey: "short" })).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
