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

describe("legal consent route", () => {
  test("returns 401 when unauthenticated", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: null } });
    const route = await import("@/app/api/legal/consent/route");
    const request = new NextRequest("http://localhost:3000/api/legal/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionIds: ["f9b1d55f-0f0a-4e4f-b7c4-c9f04fbf17cf"] })
    });
    const response = await route.POST(request);
    expect(response.status).toBe(401);
  });

  test("records missing consent rows and returns sanitized returnTo", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const insertMock = vi.fn(async () => ({ error: null }));

    serverFromMock.mockImplementation((table: string) => {
      if (table === "legal_document_versions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({
                  data: [{ id: "f9b1d55f-0f0a-4e4f-b7c4-c9f04fbf17cf", legal_document_id: "doc-1" }],
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
    });

    const route = await import("@/app/api/legal/consent/route");
    const request = new NextRequest("http://localhost:3000/api/legal/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        versionIds: ["f9b1d55f-0f0a-4e4f-b7c4-c9f04fbf17cf"],
        returnTo: "/dashboard/stores/demo"
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { ok: boolean; returnTo: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.returnTo).toBe("/dashboard/stores/demo");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
