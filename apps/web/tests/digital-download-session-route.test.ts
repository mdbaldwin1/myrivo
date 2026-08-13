import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const admin = { rpc: vi.fn() };
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ DIGITAL_DOWNLOAD_SESSION_SECRET: "session-secret-at-least-thirty-two-characters" }) }));

const TOKEN = "a".repeat(43);
const ACCESS_ID = "90000000-0000-4000-8000-000000000001";

function request(body: unknown, origin = "https://app.myrivo.test") {
  return new NextRequest("https://app.myrivo.test/api/digital-downloads/session", {
    method: "POST", headers: { origin, host: "app.myrivo.test", "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("digital download bearer exchange", () => {
  beforeEach(() => admin.rpc.mockReset());

  test("rejects hostile origins and malformed credentials before database work", async () => {
    const { POST } = await import("@/app/api/digital-downloads/session/route");
    expect((await POST(request({ token: TOKEN }, "https://evil.test"))).status).toBe(403);
    expect((await POST(request({ token: "short" }))).status).toBe(400);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  test("exchanges the body-only bearer for a secure opaque HttpOnly session without echoing it", async () => {
    admin.rpc.mockResolvedValue({ data: [{ access_token_id: ACCESS_ID, order_id: "40000000-0000-4000-8000-000000000001", store_id: "10000000-0000-4000-8000-000000000001", expires_at: "2099-08-12T12:00:00.000Z", store_name: "Studio", store_slug: "studio", license_version: "personal-use-v1" }], error: null });
    const { POST } = await import("@/app/api/digital-downloads/session/route");
    const response = await POST(request({ token: TOKEN }));
    expect(response.status).toBe(201);
    const serialized = `${await response.clone().text()} ${[...response.headers].flat().join(" ")}`;
    expect(serialized).not.toContain(TOKEN);
    expect(response.headers.get("set-cookie")).toMatch(/myrivo_download_session=v2\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}.*HttpOnly.*SameSite=Lax/i);
    expect(admin.rpc).toHaveBeenCalledWith("authorize_digital_download_access", { p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  test("returns the same neutral unavailable response for unknown and expired credentials", async () => {
    admin.rpc.mockResolvedValue({ data: [], error: null });
    const { POST } = await import("@/app/api/digital-downloads/session/route");
    const response = await POST(request({ token: TOKEN }));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "This access link is unavailable." });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
