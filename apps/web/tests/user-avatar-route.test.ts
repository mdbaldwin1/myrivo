import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const authGetUserMock = vi.fn();
const adminFromMock = vi.fn();
const storageRemoveMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) }
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args),
    storage: {
      from: () => ({
        remove: (...args: unknown[]) => storageRemoveMock(...args)
      })
    }
  }))
}));

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  authGetUserMock.mockReset();
  adminFromMock.mockReset();
  storageRemoveMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  storageRemoveMock.mockResolvedValue({ error: null });
});

describe("user avatar route", () => {
  test("DELETE with cleanup payload removes target object without clearing profile", async () => {
    const updateMock = vi.fn();

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "user_profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                avatar_path: "https://example.supabase.co/storage/v1/object/public/user-avatars/user-1/current.png"
              },
              error: null
            }))
          }))
        })),
        update: updateMock
      };
    });

    const route = await import("@/app/api/user/avatar/route");
    const request = new NextRequest("http://localhost:3000/api/user/avatar", {
      method: "DELETE",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        avatarPath: "https://example.supabase.co/storage/v1/object/public/user-avatars/user-1/temp-upload.png",
        clearProfile: false
      })
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { ok: boolean; avatarPath: string | null };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.avatarPath).toBe("https://example.supabase.co/storage/v1/object/public/user-avatars/user-1/current.png");
    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/temp-upload.png"]);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("DELETE without payload clears persisted profile avatar", async () => {
    const eqForUpdateMock = vi.fn(async () => ({ error: null }));

    adminFromMock.mockImplementation((table: string) => {
      if (table !== "user_profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                avatar_path: "https://example.supabase.co/storage/v1/object/public/user-avatars/user-1/current.png"
              },
              error: null
            }))
          }))
        })),
        update: vi.fn(() => ({ eq: eqForUpdateMock }))
      };
    });

    const route = await import("@/app/api/user/avatar/route");
    const request = new NextRequest("http://localhost:3000/api/user/avatar", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    });

    const response = await route.DELETE(request);
    const payload = (await response.json()) as { ok: boolean; avatarPath: string | null };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.avatarPath).toBeNull();
    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/current.png"]);
    expect(eqForUpdateMock).toHaveBeenCalledWith("id", "user-1");
  });
});
