import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSessionMock = vi.fn();
const authGetUserMock = vi.fn();
const recordLegalAcceptancesMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSessionMock(...args),
      getUser: (...args: unknown[]) => authGetUserMock(...args)
    }
  }))
}));

vi.mock("@/lib/legal/consent", () => ({
  recordLegalAcceptances: (...args: unknown[]) => recordLegalAcceptancesMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  exchangeCodeForSessionMock.mockReset();
  authGetUserMock.mockReset();
  recordLegalAcceptancesMock.mockReset();
  exchangeCodeForSessionMock.mockResolvedValue(undefined);
});

describe("auth callback route", () => {
  test("records signup legal acceptances after exchanging the session", async () => {
    authGetUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            signup_legal_version_ids: [
              "f9b1d55f-0f0a-4e4f-b7c4-c9f04fbf17cf",
              "1041778f-3a39-4fe4-bdb7-7ec28a1b3308"
            ]
          }
        }
      }
    });

    const route = await import("@/app/auth/callback/route");
    const response = await route.GET(
      new NextRequest("http://localhost:3000/auth/callback?code=abc123&next=%2Fdashboard")
    );

    expect(response.status).toBe(307);
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(recordLegalAcceptancesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        versionIds: [
          "f9b1d55f-0f0a-4e4f-b7c4-c9f04fbf17cf",
          "1041778f-3a39-4fe4-bdb7-7ec28a1b3308"
        ],
        acceptanceSurface: "signup"
      })
    );
  });

  test("skips legal acceptance recording when signup metadata is absent", async () => {
    authGetUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: {}
        }
      }
    });

    const route = await import("@/app/auth/callback/route");
    await route.GET(new NextRequest("http://localhost:3000/auth/callback?code=abc123&next=%2Fdashboard"));

    expect(recordLegalAcceptancesMock).not.toHaveBeenCalled();
  });

  test("redirects pending invited signups back to the invite when next falls back to dashboard", async () => {
    authGetUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            pending_store_invite_token: "abcdefghijklmnopqrstuvwxyz123456"
          }
        }
      }
    });

    const route = await import("@/app/auth/callback/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/auth/callback?code=abc123&next=%2Fdashboard"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/invite/abcdefghijklmnopqrstuvwxyz123456");
  });
});
