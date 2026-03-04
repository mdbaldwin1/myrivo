import { beforeEach, describe, expect, test, vi } from "vitest";

const env = process.env;

describe("owner access auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
    delete process.env.OWNER_ACCESS_EMAILS;
    delete process.env.MYRIVO_ALLOW_PUBLIC_SIGNUP;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  test("owner email allowlist matches configured emails", async () => {
    process.env.OWNER_ACCESS_EMAILS = "owner@example.com, sister@example.com";
    const { isOwnerAccessEmail } = await import("@/lib/auth/owner-access");

    expect(isOwnerAccessEmail("owner@example.com")).toBe(true);
    expect(isOwnerAccessEmail("SISTER@example.com")).toBe(true);
    expect(isOwnerAccessEmail("other@example.com")).toBe(false);
  });

  test("public signup defaults to disabled", async () => {
    const { isPublicSignupAllowed } = await import("@/lib/auth/owner-access");
    expect(isPublicSignupAllowed()).toBe(false);
  });

  test("public signup can be enabled explicitly", async () => {
    process.env.MYRIVO_ALLOW_PUBLIC_SIGNUP = "true";
    const { isPublicSignupAllowed } = await import("@/lib/auth/owner-access");
    expect(isPublicSignupAllowed()).toBe(true);
  });
});
