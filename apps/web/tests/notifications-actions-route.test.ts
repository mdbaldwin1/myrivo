import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();

type UpdatePayload = {
  read_at: string | null;
  status: "read" | "sent" | "dismissed";
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();
});

describe("notifications action routes", () => {
  test("PATCH returns 401 for unauthenticated user", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: null } });

    const route = await import("@/app/api/notifications/[notificationId]/route");
    const request = new NextRequest("http://localhost:3000/api/notifications/550e8400-e29b-41d4-a716-446655440000", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "read" })
    });

    const response = await route.PATCH(request, {
      params: Promise.resolve({ notificationId: "550e8400-e29b-41d4-a716-446655440000" })
    });

    expect(response.status).toBe(401);
  });

  test("PATCH marks a notification read", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    let capturedUpdate: UpdatePayload | null = null;

    serverFromMock.mockImplementation((table: string) => {
      if (table !== "notifications") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update: vi.fn((payload: UpdatePayload) => {
          capturedUpdate = payload;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "550e8400-e29b-41d4-a716-446655440000",
                      title: "New order",
                      status: "read",
                      read_at: payload.read_at
                    },
                    error: null
                  }))
                }))
              }))
            }))
          };
        })
      };
    });

    const route = await import("@/app/api/notifications/[notificationId]/route");
    const request = new NextRequest("http://localhost:3000/api/notifications/550e8400-e29b-41d4-a716-446655440000", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "read" })
    });

    const response = await route.PATCH(request, {
      params: Promise.resolve({ notificationId: "550e8400-e29b-41d4-a716-446655440000" })
    });
    const payload = (await response.json()) as { notification: { status: string; read_at: string | null } };

    expect(response.status).toBe(200);
    expect(payload.notification.status).toBe("read");
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.status).toBe("read");
    expect(capturedUpdate!.read_at).not.toBeNull();
  });

  test("PATCH dismisses a notification", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    let capturedUpdate: UpdatePayload | null = null;

    serverFromMock.mockImplementation((table: string) => {
      if (table !== "notifications") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update: vi.fn((payload: UpdatePayload) => {
          capturedUpdate = payload;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "550e8400-e29b-41d4-a716-446655440000",
                      title: "New order",
                      status: "dismissed",
                      read_at: payload.read_at
                    },
                    error: null
                  }))
                }))
              }))
            }))
          };
        })
      };
    });

    const route = await import("@/app/api/notifications/[notificationId]/route");
    const request = new NextRequest("http://localhost:3000/api/notifications/550e8400-e29b-41d4-a716-446655440000", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "dismiss" })
    });

    const response = await route.PATCH(request, {
      params: Promise.resolve({ notificationId: "550e8400-e29b-41d4-a716-446655440000" })
    });

    expect(response.status).toBe(200);
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.status).toBe("dismissed");
    expect(capturedUpdate!.read_at).not.toBeNull();
  });

  test("POST read-all marks all unread notifications as read", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    let capturedUpdate: UpdatePayload | null = null;

    serverFromMock.mockImplementation((table: string) => {
      if (table !== "notifications") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update: vi.fn((payload: UpdatePayload) => {
          capturedUpdate = payload;
          return {
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                neq: vi.fn(() => ({
                  select: vi.fn(async () => ({
                    data: [{ id: "n-1" }, { id: "n-2" }],
                    error: null
                  }))
                }))
              }))
            }))
          };
        })
      };
    });

    const route = await import("@/app/api/notifications/read-all/route");
    const response = await route.POST();
    const payload = (await response.json()) as { ok: boolean; updatedCount: number };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.updatedCount).toBe(2);
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.status).toBe("read");
    expect(capturedUpdate!.read_at).not.toBeNull();
  });
});
