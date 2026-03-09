import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();

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

describe("notifications list route", () => {
  test("GET returns 401 for unauthenticated user", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: null } });

    const route = await import("@/app/api/notifications/route");
    const response = await route.GET(new NextRequest("http://localhost:3000/api/notifications"));

    expect(response.status).toBe(401);
  });

  test("GET returns notifications and unread count", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    serverFromMock.mockImplementation((table: string) => {
      if (table !== "notifications") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            return {
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  neq: vi.fn(async () => ({ count: 2, error: null }))
                }))
              }))
            };
          }

          const query = {
            eq: vi.fn(() => query),
            order: vi.fn(() => query),
            is: vi.fn(() => query),
            neq: vi.fn(() => query),
            not: vi.fn(() => query),
            range: vi.fn(async () => ({
              data: [
                {
                  id: "f9b1d55f-0f0a-4e4f-b7c4-c9f04fbf17cf",
                  title: "New order",
                  status: "sent",
                  read_at: null
                }
              ],
              error: null
            }))
          };

          return query;
        })
      };
    });

    const route = await import("@/app/api/notifications/route");
    const response = await route.GET(
      new NextRequest("http://localhost:3000/api/notifications?status=unread&limit=10&offset=0")
    );
    const payload = (await response.json()) as {
      notifications: Array<{ id: string }>;
      unreadCount: number;
      pagination: { limit: number; offset: number };
    };

    expect(response.status).toBe(200);
    expect(payload.notifications).toHaveLength(1);
    expect(payload.unreadCount).toBe(2);
    expect(payload.pagination).toEqual({ limit: 10, offset: 0 });
  });
});
