import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args)
    }
  }))
}));

beforeEach(() => {
  enforceTrustedOriginMock.mockReset();
  resetPasswordForEmailMock.mockReset();
  enforceTrustedOriginMock.mockReturnValue(null);
  resetPasswordForEmailMock.mockResolvedValue({ error: null });
});

describe("forgot password route", () => {
  test("POST sends reset email through auth callback with reset-password destination", async () => {
    const route = await import("@/app/api/auth/forgot-password/route");
    const request = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        email: "owner@example.com",
        returnTo: "/profile"
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("owner@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=%2Freset-password%3FreturnTo%3D%252Fprofile"
    });
  });
});
