import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("transactional email provider idempotency", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    process.env.MYRIVO_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.MYRIVO_EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
  });

  test("sends the stable delivery key to Resend without placing it in the body", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ id: "email_resend_123" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { sendTransactionalEmail } = await import("@/lib/notifications/email-provider");

    await expect(sendTransactionalEmail({
      from: "orders@myrivo.test",
      to: ["buyer@example.test"],
      subject: "Downloads ready",
      text: "Your files are ready.",
      idempotencyKey: "digital-delivery:job-123"
    })).resolves.toMatchObject({ ok: true, messageId: "email_resend_123" });

    const request = fetchMock.mock.calls[0]?.[1];
    if (!request) throw new Error("Expected Resend request options");
    expect(new Headers(request.headers).get("Idempotency-Key")).toBe(
      "digital-delivery:job-123"
    );
    expect(request.body).not.toContain("digital-delivery:job-123");
  });
});
