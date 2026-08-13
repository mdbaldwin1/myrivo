import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  claimJob: vi.fn(),
  sendEmail: vi.fn(),
  prepareRefundEmail: vi.fn(),
  prepareDisputeEmail: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/digital-products/delivery-jobs", () => ({
  claimDigitalDeliveryJob: (...args: unknown[]) => mocks.claimJob(...args),
  completeDigitalDeliveryJob: vi.fn(),
  markDigitalDeliveryNotificationSent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  prepareDigitalAccessRecoveryEmail: vi.fn(),
  prepareDigitalDeliveryOrderConfirmationEmail: vi.fn(),
  prepareOrderRefundNotificationEmail: (...args: unknown[]) =>
    mocks.prepareRefundEmail(...args),
  prepareOrderDisputeNotificationEmail: (...args: unknown[]) =>
    mocks.prepareDisputeEmail(...args),
}));

vi.mock("@/lib/notifications/email-provider", () => ({
  sendTransactionalEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

type QueueItem = {
  id: string;
  notificationType: "purchase" | "refund";
  attemptCount: number;
  status: "pending" | "succeeded";
};

const financialId = "10000000-0000-4000-8000-000000000201";
const accessId = "10000000-0000-4000-8000-000000000202";

function rpcClaim(item: QueueItem) {
  const financial = item.notificationType === "refund";
  return {
    id: item.id,
    store_id: "20000000-0000-4000-8000-000000000201",
    order_id: "30000000-0000-4000-8000-000000000201",
    delivery_job_id: financial
      ? null
      : "40000000-0000-4000-8000-000000000201",
    access_token_id: financial
      ? null
      : "50000000-0000-4000-8000-000000000201",
    notification_type: item.notificationType,
    lease_token: "60000000-0000-4000-8000-000000000201",
    attempt_number: item.attemptCount,
    token_derivation_nonce: financial
      ? null
      : "70000000-0000-4000-8000-000000000201",
    token_hash: financial ? null : "a".repeat(64),
    file_count: financial ? 0 : 1,
    refund_id: financial
      ? "80000000-0000-4000-8000-000000000201"
      : null,
    dispute_id: null,
    financial_status: financial ? "succeeded" : null,
  };
}

function installQueue(items: QueueItem[]) {
  mocks.rpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_digital_delivery_notification") {
        const includeAccess = args.p_include_access_notifications !== false;
        const item = items.find(
          (candidate) =>
            candidate.status === "pending" &&
            (includeAccess || candidate.notificationType === "refund"),
        );
        if (!item) return { data: null, error: null };
        item.attemptCount += 1;
        item.status = "succeeded";
        return { data: rpcClaim(item), error: null };
      }
      if (name === "complete_digital_delivery_notification") {
        return {
          data: { status: "succeeded", next_attempt_at: null },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  );
}

async function invokeRoute() {
  const route = await import(
    "@/app/api/internal/digital-delivery/process/route"
  );
  return route.POST(
    new NextRequest("http://localhost/api/internal/digital-delivery/process", {
      method: "POST",
      headers: {
        authorization:
          "Bearer correct-process-secret-that-is-long-enough",
      },
    }),
  );
}

describe("digital delivery process route without bearer derivation", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.claimJob.mockReset().mockResolvedValue(null);
    mocks.sendEmail.mockReset().mockResolvedValue({
      ok: true,
      provider: "resend",
      error: null,
    });
    mocks.prepareRefundEmail.mockReset().mockResolvedValue({
      from: "Store <orders@mailer.myrivo.test>",
      to: ["buyer@example.test"],
      subject: "Refund processed",
      text: "Your refund was processed.",
      html: "<p>Your refund was processed.</p>",
      replyTo: "support@example.test",
    });
    mocks.prepareDisputeEmail.mockReset();
    mocks.rpc.mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    process.env.DIGITAL_DELIVERY_PROCESS_SECRET =
      "correct-process-secret-that-is-long-enough";
    delete process.env.DIGITAL_DELIVERY_TOKEN_SECRET;
  });

  test("sends a queued financial notification without a token secret", async () => {
    const queue: QueueItem[] = [
      {
        id: financialId,
        notificationType: "refund",
        attemptCount: 0,
        status: "pending",
      },
    ];
    installQueue(queue);

    const response = await invokeRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      claimed: 1,
      succeeded: 1,
      configurationIssues: ["digital_delivery_token_unconfigured"],
    });
    expect(queue[0]).toMatchObject({ attemptCount: 1, status: "succeeded" });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.claimJob).not.toHaveBeenCalled();
  });

  test("does not claim or consume bearer-dependent notifications", async () => {
    const queue: QueueItem[] = [
      {
        id: accessId,
        notificationType: "purchase",
        attemptCount: 0,
        status: "pending",
      },
    ];
    installQueue(queue);

    const response = await invokeRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      claimed: 0,
      configurationIssues: ["digital_delivery_token_unconfigured"],
    });
    expect(queue[0]).toMatchObject({ attemptCount: 0, status: "pending" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.claimJob).not.toHaveBeenCalled();
  });

  test("continues financial work when bearer-dependent work is also queued", async () => {
    const queue: QueueItem[] = [
      {
        id: accessId,
        notificationType: "purchase",
        attemptCount: 0,
        status: "pending",
      },
      {
        id: financialId,
        notificationType: "refund",
        attemptCount: 0,
        status: "pending",
      },
    ];
    installQueue(queue);

    const response = await invokeRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      claimed: 1,
      succeeded: 1,
      configurationIssues: ["digital_delivery_token_unconfigured"],
    });
    expect(queue).toEqual([
      expect.objectContaining({ attemptCount: 0, status: "pending" }),
      expect.objectContaining({ attemptCount: 1, status: "succeeded" }),
    ]);
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.claimJob).not.toHaveBeenCalled();
  });
});
