import { describe, expect, test } from "vitest";
import { sanitizeInviteToken } from "@/lib/auth/invite-token";

describe("sanitizeInviteToken", () => {
  test("returns normalized token when valid", () => {
    expect(sanitizeInviteToken("  abcdefghijklmnopqrstuvwx123456  ")).toBe("abcdefghijklmnopqrstuvwx123456");
  });

  test("returns null when token is too short", () => {
    expect(sanitizeInviteToken("short")).toBeNull();
  });

  test("returns null when token has unsupported characters", () => {
    expect(sanitizeInviteToken("token with spaces and punctuation!!")).toBeNull();
  });
});
