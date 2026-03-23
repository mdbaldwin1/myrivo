import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sendTransactionalEmailMock = vi.fn();

vi.mock("@/lib/notifications/email-provider", () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmailMock(...args)
}));

describe("team invite emails", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.MYRIVO_PUBLIC_APP_URL = "https://www.myrivo.app";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.MYRIVO_EMAIL_PLATFORM_FROM = "hello@myrivo.app";
    process.env.MYRIVO_EMAIL_REPLY_TO = "support@myrivo.app";
    sendTransactionalEmailMock.mockReset();
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, provider: "resend", error: null });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.MYRIVO_PUBLIC_APP_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.MYRIVO_EMAIL_PLATFORM_FROM;
    delete process.env.MYRIVO_EMAIL_REPLY_TO;
    vi.resetModules();
  });

  test("store membership invites use the canonical public app URL", async () => {
    const { sendStoreMembershipInviteEmail } = await import("@/lib/notifications/team-invites");

    await sendStoreMembershipInviteEmail({
      recipientEmail: "teammate@example.com",
      storeName: "At Home Apothecary",
      inviterName: "Margie",
      role: "staff",
      inviteToken: "invite-token-123",
      expiresAt: "2030-01-01T00:00:00.000Z"
    });

    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["teammate@example.com"],
        text: expect.stringContaining("https://www.myrivo.app/invite/invite-token-123")
      })
    );
    expect(sendTransactionalEmailMock.mock.calls[0]?.[0]?.text).not.toContain("http://localhost:3000/invite/");
  });
});
