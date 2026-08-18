import { describe, expect, test } from "vitest";
import { extractPendingStoreInviteTokenFromReturnTo, resolvePostAuthReturnTo } from "@/lib/auth/pending-store-invite";

describe("pending store invite helpers", () => {
  test("extracts invite token from returnTo", () => {
    expect(extractPendingStoreInviteTokenFromReturnTo("/invite/abcdefghijklmnopqrstuvwxyz123456")).toBe("abcdefghijklmnopqrstuvwxyz123456");
    expect(extractPendingStoreInviteTokenFromReturnTo("/dashboard")).toBeNull();
  });

  test("prefers pending invite path when returnTo falls back to dashboard", () => {
    expect(
      resolvePostAuthReturnTo("/dashboard", {
        pending_store_invite_token: "abcdefghijklmnopqrstuvwxyz123456"
      })
    ).toBe("/invite/abcdefghijklmnopqrstuvwxyz123456");
  });

  test("preserves explicit non-dashboard returnTo", () => {
    expect(
      resolvePostAuthReturnTo("/profile", {
        pending_store_invite_token: "abcdefghijklmnopqrstuvwxyz123456"
      })
    ).toBe("/profile");
  });
  test("sends sellers to the dashboard when sign-in came from the public home page", () => {
    expect(resolvePostAuthReturnTo("/", null)).toBe("/dashboard");
    expect(resolvePostAuthReturnTo(null, null)).toBe("/dashboard");
  });

  test("still honours a pending invite over a home-page return", () => {
    expect(
      resolvePostAuthReturnTo("/", {
        pending_store_invite_token: "abcdefghijklmnopqrstuvwxyz123456"
      })
    ).toBe("/invite/abcdefghijklmnopqrstuvwxyz123456");
  });
});
