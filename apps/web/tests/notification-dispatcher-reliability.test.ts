import { beforeEach, describe, expect, test, vi } from "vitest";

const adminFromMock = vi.fn();
const sendTransactionalEmailMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/notifications/email-provider", () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmailMock(...args)
}));

function makeHeadCountQuery(count: number) {
  const query: {
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    then: (resolve: (value: { count: number; error: null }) => unknown) => unknown;
  } = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    then: (resolve) => resolve({ count, error: null })
  };
  return query;
}

beforeEach(() => {
  vi.resetModules();
  adminFromMock.mockReset();
  sendTransactionalEmailMock.mockReset();
});

describe("notification dispatcher reliability", () => {
  test("skips dispatch when throttled for recipient + event", async () => {
    let notificationsInsertCalled = false;

    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "user-1", email: "owner@example.com", metadata: {} },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "notifications") {
        return {
          select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return makeHeadCountQuery(12);
            }

            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: "existing-1" }, error: null }))
                }))
              }))
            };
          }),
          insert: vi.fn(() => {
            notificationsInsertCalled = true;
            return {
              select: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "notif-1" }, error: null }))
              }))
            };
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { dispatchNotification } = await import("@/lib/notifications/dispatcher");
    const result = await dispatchNotification({
      recipientUserId: "user-1",
      storeId: "store-1",
      eventType: "order.created.owner",
      title: "New order",
      body: "Order 123",
      actionUrl: "/dashboard/orders"
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("Throttled");
    expect(notificationsInsertCalled).toBe(false);
  });

  test("retries email delivery attempts and marks sent on later success", async () => {
    const deliveryAttempts: Array<Record<string, unknown>> = [];
    const notificationUpdates: Array<Record<string, unknown>> = [];

    sendTransactionalEmailMock
      .mockResolvedValueOnce({ ok: false, provider: "resend", error: "timeout" })
      .mockResolvedValueOnce({ ok: false, provider: "resend", error: "temporary 500" })
      .mockResolvedValueOnce({ ok: true, provider: "resend", error: null });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "user-1", email: "owner@example.com", metadata: {} },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "notifications") {
        return {
          select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return makeHeadCountQuery(0);
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: "existing-1" }, error: null }))
                }))
              }))
            };
          }),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { id: "notif-1" }, error: null }))
            }))
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            notificationUpdates.push(payload);
            return {
              eq: vi.fn(async () => ({ error: null }))
            };
          })
        };
      }

      if (table === "notification_delivery_attempts") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            deliveryAttempts.push(payload);
            return Promise.resolve({ error: null });
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { dispatchNotification } = await import("@/lib/notifications/dispatcher");
    const result = await dispatchNotification({
      recipientUserId: "user-1",
      storeId: "store-1",
      eventType: "order.created.owner",
      title: "New order",
      body: "Order 123",
      actionUrl: "/dashboard/orders",
      channelTargets: ["email"],
      email: {
        from: "orders@mailer.myrivo.com",
        subject: "New order",
        text: "Order 123"
      }
    });

    expect(result.ok).toBe(true);
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(3);
    expect(deliveryAttempts).toHaveLength(3);
    expect(notificationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "sent"
        })
      ])
    );
  });
});
