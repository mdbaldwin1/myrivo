import { describe, expect, test } from "vitest";
import {
  queueMerchantDigitalDeliveryResend,
  type DigitalDeliveryNotificationRpcClient,
} from "@/lib/digital-products/delivery-email";

const input = {
  orderId: "10000000-0000-4000-8000-000000000201",
  storeId: "20000000-0000-4000-8000-000000000201",
  actorUserId: "30000000-0000-4000-8000-000000000201",
  idempotencyKey: "merchant-resend-click-1",
  tokenSecret: "a-digital-delivery-secret-with-more-than-thirty-two-characters",
};

describe("merchant digital delivery resend service", () => {
  test("hashes the idempotency key and bearer token before the transactional RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: DigitalDeliveryNotificationRpcClient = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {
          data: {
            notification_id: args.p_notification_id,
            access_token_id: args.p_access_token_id,
            status: "pending",
            duplicate: false,
          },
          error: null,
        };
      },
    };

    const result = await queueMerchantDigitalDeliveryResend({ ...input, client });

    expect(result).toMatchObject({ ok: true, status: "queued", duplicate: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("prepare_merchant_digital_delivery_resend");
    expect(calls[0]?.args.p_request_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(calls[0]?.args)).not.toContain(input.idempotencyKey);
    expect(JSON.stringify(result)).not.toMatch(/token_hash|tokenDerivationNonce|downloads\//i);
  });

  test("maps an ineligible revoked, refunded, or disputed order to a safe result", async () => {
    const client: DigitalDeliveryNotificationRpcClient = {
      rpc: async () => ({
        data: null,
        error: { message: "Digital delivery resend is ineligible" },
      }),
    };

    await expect(
      queueMerchantDigitalDeliveryResend({ ...input, client }),
    ).resolves.toEqual({ ok: false, reason: "ineligible" });
  });

  test("does not leak a wrong-tenant order distinction", async () => {
    const client: DigitalDeliveryNotificationRpcClient = {
      rpc: async () => ({
        data: null,
        error: { message: "Digital delivery order is unavailable" },
      }),
    };

    await expect(
      queueMerchantDigitalDeliveryResend({ ...input, client }),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
  });

  test("returns the existing notification for an idempotent duplicate without exposing its token", async () => {
    const client: DigitalDeliveryNotificationRpcClient = {
      rpc: async (_name, args) => ({
        data: {
          notification_id: "40000000-0000-4000-8000-000000000201",
          access_token_id: "50000000-0000-4000-8000-000000000201",
          status: "pending",
          duplicate: true,
          token_derivation_nonce: args.p_token_derivation_nonce,
          token_hash: args.p_token_hash,
        },
        error: null,
      }),
    };

    await expect(
      queueMerchantDigitalDeliveryResend({ ...input, client }),
    ).resolves.toEqual({
      ok: true,
      status: "queued",
      duplicate: true,
      notificationId: "40000000-0000-4000-8000-000000000201",
    });
  });
});
