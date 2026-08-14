import { describe, expect, test } from "vitest";
import {
  buildDigitalDeliveryAccessBlock,
  resolveDigitalDeliveryNotificationAccessToken,
  processNextDigitalDeliveryNotification,
  sanitizeDigitalDeliveryNotificationError,
  type DigitalDeliveryNotificationProcessorDependencies,
} from "@/lib/digital-products/delivery-email";
import { deriveCustomerRecoveryAccessToken } from "@/lib/digital-products/customer-access";
import {
  buildDigitalAccessRecoveryEmailContent,
  shouldSendCustomerOrderConfirmation,
} from "@/lib/notifications/order-emails";

const claim = {
  id: "10000000-0000-4000-8000-000000000101",
  storeId: "20000000-0000-4000-8000-000000000101",
  orderId: "30000000-0000-4000-8000-000000000101",
  deliveryJobId: "40000000-0000-4000-8000-000000000101",
  accessTokenId: "50000000-0000-4000-8000-000000000101",
  notificationType: "purchase" as const,
  leaseToken: "60000000-0000-4000-8000-000000000101",
  attemptNumber: 1,
  tokenDerivationNonce: "70000000-0000-4000-8000-000000000101",
  tokenHash: "a".repeat(64),
  fileCount: 2,
  refundId: null,
  disputeId: null,
  financialStatus: null,
};

function makeDependencies(
  overrides: Partial<DigitalDeliveryNotificationProcessorDependencies> = {},
): DigitalDeliveryNotificationProcessorDependencies {
  return {
    claimNotification: async () => claim,
    buildMessage: async () => ({
      from: "Store <orders@mailer.myrivo.test>",
      to: ["buyer@example.test"],
      subject: "Your order and downloads are ready",
      text: "Safe customer message",
      html: "<p>Safe customer message</p>",
      replyTo: "support@example.test",
    }),
    sendEmail: async () => ({ ok: true, provider: "resend", error: null, messageId: "email_default" }),
    completeNotification: async ({ outcome }) => ({
      status: outcome === "succeeded" ? "succeeded" : "pending",
      nextAttemptAt:
        outcome === "succeeded" ? null : "2026-08-13T15:01:00.000Z",
    }),
    ...overrides,
  };
}

describe("digital delivery email content", () => {
  test("delays digital-only and mixed customer confirmations until secure access exists", () => {
    expect(
      shouldSendCustomerOrderConfirmation({
        alreadySent: false,
        hasDigitalItems: true,
      }),
    ).toBe(false);
    expect(
      shouldSendCustomerOrderConfirmation({
        alreadySent: false,
        hasDigitalItems: false,
      }),
    ).toBe(true);
    expect(
      shouldSendCustomerOrderConfirmation({
        alreadySent: true,
        hasDigitalItems: false,
      }),
    ).toBe(false);
  });

  test("adds neutral access copy for a digital-only or mixed order without file metadata", () => {
    const accessUrl = "https://myrivo.test/downloads/opaque-bearer-token";
    const block = buildDigitalDeliveryAccessBlock({
      fileCount: 3,
      accessUrl,
    });

    expect(block.text).toContain("3 digital files");
    expect(block.text).toContain("48 hours");
    expect(block.text).toContain(accessUrl);
    expect(block.text).toContain("personal use");
    expect(block.html).toContain("opaque-bearer-token");
    expect(block.text).not.toMatch(/storage|bucket|object path|signed url/i);
    expect(block.text).not.toMatch(/\.pdf|\.zip|\.png|\.jpe?g/i);
  });

  test("uses singular customer copy for one file", () => {
    const block = buildDigitalDeliveryAccessBlock({
      fileCount: 1,
      accessUrl: "https://myrivo.test/downloads/token",
    });

    expect(block.text).toContain("1 digital file");
    expect(block.text).not.toContain("1 digital files");
  });

  test("renders a focused fresh-link email with expiry, order, license, and support guidance", () => {
    const content = buildDigitalAccessRecoveryEmailContent({
      storeName: "Rachel's <Prints>",
      orderId: "30000000-0000-4000-8000-000000000101",
      accessUrl: "https://myrivo.test/downloads/opaque-bearer-token",
      supportEmail: "support@example.test",
    });

    expect(content.subject).toBe("Your fresh download link from Rachel's <Prints>");
    expect(content.text).toContain("Order 30000000");
    expect(content.text).toContain("48 hours");
    expect(content.text).toContain("personal-use license");
    expect(content.text).toContain("support@example.test");
    expect(content.html).toContain("Rachel&#39;s &lt;Prints&gt;");
    expect(content.html).not.toContain("Rachel's <Prints>");
    expect(content.text).not.toMatch(/storage|bucket|signed url/i);
  });
});

describe("digital delivery notification processor", () => {
  test("reconstructs a customer recovery bearer only from its dedicated derivation domain", () => {
    const recoveryClaim = {
      ...claim,
      deliveryJobId: null,
      notificationType: "customer_recovery" as const,
      tokenHash: "ignored-by-this-pure-contract",
    };
    const secret = "digital-delivery-token-secret-longer-than-thirty-two-characters";

    const recovered = resolveDigitalDeliveryNotificationAccessToken(
      recoveryClaim,
      secret,
    );

    expect(recovered).toBe(
      deriveCustomerRecoveryAccessToken({
        notificationId: recoveryClaim.id,
        nonce: recoveryClaim.tokenDerivationNonce,
        secret,
      }),
    );
    expect(recovered).not.toBe(
      resolveDigitalDeliveryNotificationAccessToken(
        { ...recoveryClaim, notificationType: "merchant_resend" },
        secret,
      ),
    );
  });

  test("records a configured provider success with a notification-scoped idempotency key", async () => {
    const sentKeys: string[] = [];
    const completions: Array<Record<string, unknown>> = [];
    const dependencies = makeDependencies({
      sendEmail: async (_message, idempotencyKey) => {
        sentKeys.push(idempotencyKey);
        return { ok: true, provider: "resend", error: null, messageId: "email_delivery_123" };
      },
      completeNotification: async (input) => {
        completions.push(input);
        return { status: "succeeded", nextAttemptAt: null };
      },
    });

    await expect(processNextDigitalDeliveryNotification(dependencies)).resolves.toEqual({
      status: "succeeded",
      notificationId: claim.id,
      nextAttemptAt: null,
    });
    expect(sentKeys).toEqual([`digital-order-delivery:${claim.id}`]);
    expect(completions).toEqual([
      expect.objectContaining({
        outcome: "succeeded",
        provider: "resend",
        providerMessageId: "email_delivery_123",
        safeError: null,
      }),
    ]);
  });

  test("records an unconfigured sender as a retryable sanitized failure", async () => {
    const completions: Array<Record<string, unknown>> = [];
    const dependencies = makeDependencies({
      buildMessage: async () => {
        throw new Error("Digital delivery email configuration is unavailable");
      },
      completeNotification: async (input) => {
        completions.push(input);
        return {
          status: "pending",
          nextAttemptAt: "2026-08-13T15:01:00.000Z",
        };
      },
    });

    await expect(processNextDigitalDeliveryNotification(dependencies)).resolves.toMatchObject({
      status: "pending",
    });
    expect(completions).toEqual([
      expect.objectContaining({
        outcome: "failed",
        provider: "resend",
        safeError: "Digital delivery email configuration is unavailable",
      }),
    ]);
  });

  test("persists provider failure without bearer tokens, recipients, or response internals", async () => {
    const completions: Array<Record<string, unknown>> = [];
    const dependencies = makeDependencies({
      sendEmail: async () => ({
        ok: false,
        provider: "resend",
        error:
          "Resend 500 request req_123 buyer@example.test https://myrivo.test/downloads/raw-bearer-token Authorization: Bearer secret",
      }),
      completeNotification: async (input) => {
        completions.push(input);
        return {
          status: "pending",
          nextAttemptAt: "2026-08-13T15:01:00.000Z",
        };
      },
    });

    await processNextDigitalDeliveryNotification(dependencies);
    const safeError = String(completions[0]?.safeError);
    expect(safeError).not.toContain("req_123");
    expect(safeError).not.toContain("buyer@example.test");
    expect(safeError).not.toContain("raw-bearer-token");
    expect(safeError).not.toContain("secret");
  });

  test("lets durable claiming suppress duplicate job execution", async () => {
    let claims = 0;
    let sends = 0;
    const dependencies = makeDependencies({
      claimNotification: async () => (claims++ === 0 ? claim : null),
      sendEmail: async () => {
        sends += 1;
        return { ok: true, provider: "resend", error: null, messageId: "email_financial" };
      },
    });

    await expect(processNextDigitalDeliveryNotification(dependencies)).resolves.toMatchObject({
      status: "succeeded",
    });
    await expect(processNextDigitalDeliveryNotification(dependencies)).resolves.toEqual({
      status: "idle",
      notificationId: null,
      nextAttemptAt: null,
    });
    expect(sends).toBe(1);
  });

  test("retries a financial notification with one provider idempotency key", async () => {
    const financialClaim = {
      ...claim,
      deliveryJobId: null,
      accessTokenId: null,
      notificationType: "refund" as const,
      tokenDerivationNonce: null,
      tokenHash: null,
      fileCount: 0,
      refundId: "80000000-0000-4000-8000-000000000101",
      disputeId: null,
      financialStatus: "succeeded",
    };
    let attempt = 0;
    let delivered = 0;
    const acceptedKeys = new Set<string>();
    const dependencies = makeDependencies({
      claimNotification: async () =>
        attempt < 2
          ? ({ ...financialClaim, attemptNumber: ++attempt } as never)
          : null,
      sendEmail: async (_message, idempotencyKey) => {
        if (!acceptedKeys.has(idempotencyKey)) {
          acceptedKeys.add(idempotencyKey);
          delivered += 1;
        }
        return attempt === 1
          ? { ok: false, provider: "resend", error: "provider unavailable" }
          : { ok: true, provider: "resend", error: null, messageId: "email_retry" };
      },
      completeNotification: async ({ outcome }) => ({
        status: outcome === "succeeded" ? "succeeded" : "pending",
        nextAttemptAt:
          outcome === "succeeded" ? null : "2026-08-13T20:01:00.000Z",
      }),
    });

    await expect(processNextDigitalDeliveryNotification(dependencies)).resolves.toMatchObject({
      status: "pending",
    });
    await expect(processNextDigitalDeliveryNotification(dependencies)).resolves.toMatchObject({
      status: "succeeded",
    });
    expect(acceptedKeys).toEqual(
      new Set([`financial-order-notification:${financialClaim.id}`]),
    );
    expect(delivered).toBe(1);
  });

  test("sanitizes credential, email, bearer-link, storage-path, and provider response details", () => {
    const safe = sanitizeDigitalDeliveryNotificationError(
      new Error(
        "RESEND_API_KEY=re_123 buyer@example.test Authorization: Bearer token " +
          "https://myrivo.test/downloads/raw-token private/store/product/file.pdf request req_abc " +
          "x".repeat(700),
      ),
    );

    expect(safe.length).toBeLessThanOrEqual(500);
    expect(safe).not.toMatch(/re_123|buyer@example|raw-token|private\/store|req_abc|Bearer token/);
  });
});
