import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const observe = vi.fn();
vi.mock("@/lib/digital-products/acceptance-control", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/digital-products/acceptance-control")>()),
  executeDigitalAcceptanceControl: (...args: unknown[]) => observe(...args),
}));

describe("digital acceptance control route", () => {
  beforeEach(() => {
    vi.resetModules();
    observe.mockReset();
    process.env.MYRIVO_DIGITAL_ACCEPTANCE_CONTROL_SECRET = "s".repeat(32);
    process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT = "test";
    process.env.VERCEL_ENV = "preview";
    process.env.MYRIVO_DIGITAL_ACCEPTANCE_ORIGIN = "http://localhost";
    process.env.MYRIVO_DIGITAL_ACCEPTANCE_PROJECT_REF = "test-project";
    process.env.MYRIVO_DIGITAL_ACCEPTANCE_BUILD = "enabled";
  });

  it("is unavailable in production even with a valid credential", async () => {
    process.env.VERCEL_ENV = "production";
    const { POST } = await import("@/app/api/internal/digital-products/acceptance/route");
    const response = await POST(new NextRequest("https://example.test/api/internal/digital-products/acceptance", {
      method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` }, body: JSON.stringify({ version: 1, action: "observe", runId: crypto.randomUUID(), subjectId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }),
    }));
    expect(response.status).toBe(404);
    expect(observe).not.toHaveBeenCalled();
  });

  it("is unavailable in self-hosted production without a Vercel marker", async () => {
    delete process.env.VERCEL_ENV;
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("@/app/api/internal/digital-products/acceptance/route");
    const response = await POST(new NextRequest("http://localhost/api/internal/digital-products/acceptance", { method: "POST" }));
    expect(response.status).toBe(404);
    expect(observe).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("allows an explicitly allowlisted deployed preview despite production Node mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    observe.mockResolvedValue({ version: 1, runId: "10000000-0000-4000-8000-000000000001", observedAt: new Date().toISOString(), observation: {} });
    const { POST } = await import("@/app/api/internal/digital-products/acceptance/route");
    const response = await POST(new NextRequest("http://localhost/api/internal/digital-products/acceptance", {
      method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` }, body: JSON.stringify({ version: 1, action: "observe", runId: "10000000-0000-4000-8000-000000000001", subjectId: "20000000-0000-4000-8000-000000000001", idempotencyKey: "30000000-0000-4000-8000-000000000001" }),
    }));
    expect(response.status).toBe(200);
    vi.unstubAllEnvs();
  });

  it("is unavailable unless an explicit test-only environment is configured", async () => {
    delete process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT;
    const { POST } = await import("@/app/api/internal/digital-products/acceptance/route");
    const response = await POST(new NextRequest("http://localhost/api/internal/digital-products/acceptance", { method: "POST" }));
    expect(response.status).toBe(404);
    expect(observe).not.toHaveBeenCalled();
  });

  it("rejects missing authentication before parsing or querying state", async () => {
    const { POST } = await import("@/app/api/internal/digital-products/acceptance/route");
    const response = await POST(new NextRequest("http://localhost/api/internal/digital-products/acceptance", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(observe).not.toHaveBeenCalled();
  });

  it("returns independently observed state without accepting expected state", async () => {
    observe.mockResolvedValue({ runId: "10000000-0000-4000-8000-000000000001", observation: { orderStatus: "paid" } });
    const { POST } = await import("@/app/api/internal/digital-products/acceptance/route");
    const response = await POST(new NextRequest("http://localhost/api/internal/digital-products/acceptance", {
      method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` }, body: JSON.stringify({ version: 1, action: "observe", runId: "10000000-0000-4000-8000-000000000001", subjectId: "20000000-0000-4000-8000-000000000001", idempotencyKey: "30000000-0000-4000-8000-000000000001", expected: { orderStatus: "failed" } }),
    }));
    expect(response.status).toBe(400);
    expect(observe).not.toHaveBeenCalled();
  });
});
