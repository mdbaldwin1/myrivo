import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { getExternalAppUrl, getServerEnv } from "@/lib/env";
import {
  prepareDigitalAccessRecoveryEmail,
  prepareDigitalDeliveryOrderConfirmationEmail,
  prepareOrderDisputeNotificationEmail,
  prepareOrderRefundNotificationEmail,
  type PreparedOrderEmailMessage,
} from "@/lib/notifications/order-emails";
import {
  sendTransactionalEmail,
  type SendTransactionalEmailResult,
} from "@/lib/notifications/email-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import { deriveCustomerRecoveryAccessToken } from "./customer-access";
import {
  deriveDigitalAccessToken,
  hashDigitalAccessToken,
} from "./entitlements";
import type { DigitalDeliveryJobClaim } from "./delivery-jobs";

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type DigitalDeliveryNotificationRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

export type DigitalDeliveryNotificationClaim = {
  id: string;
  storeId: string;
  orderId: string;
  deliveryJobId: string | null;
  accessTokenId: string | null;
  notificationType: "purchase" | "merchant_resend" | "customer_recovery" | "refund" | "dispute";
  leaseToken: string;
  attemptNumber: number;
  tokenDerivationNonce: string | null;
  tokenHash: string | null;
  fileCount: number;
  refundId: string | null;
  disputeId: string | null;
  financialStatus: string | null;
};

type NotificationCompletion = {
  status: "pending" | "succeeded" | "failed";
  nextAttemptAt: string | null;
};

export type DigitalDeliveryNotificationProcessorDependencies = {
  claimNotification: (
    notificationId?: string,
  ) => Promise<DigitalDeliveryNotificationClaim | null>;
  buildMessage: (
    claim: DigitalDeliveryNotificationClaim,
  ) => Promise<PreparedOrderEmailMessage>;
  sendEmail: (
    message: PreparedOrderEmailMessage,
    idempotencyKey: string,
  ) => Promise<SendTransactionalEmailResult>;
  completeNotification: (input: {
    claim: DigitalDeliveryNotificationClaim;
    outcome: "succeeded" | "failed";
    provider: "resend";
    safeError: string | null;
  }) => Promise<NotificationCompletion>;
};

const claimSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  order_id: z.string().uuid(),
  delivery_job_id: z.string().uuid().nullable(),
  access_token_id: z.string().uuid().nullable(),
  notification_type: z.enum(["purchase", "merchant_resend", "customer_recovery", "refund", "dispute"]),
  lease_token: z.string().uuid(),
  attempt_number: z.number().int().positive(),
  token_derivation_nonce: z.string().uuid().nullable(),
  token_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  file_count: z.number().int().nonnegative(),
  refund_id: z.string().uuid().nullable(),
  dispute_id: z.string().uuid().nullable(),
  financial_status: z.string().nullable(),
});

const completionSchema = z.object({
  status: z.enum(["pending", "succeeded", "failed"]),
  next_attempt_at: z.string().datetime({ offset: true }).nullable(),
});

const preparedNotificationSchema = z.object({
  notification_id: z.string().uuid(),
  access_token_id: z.string().uuid(),
  status: z.enum(["pending", "processing", "succeeded", "failed"]),
  duplicate: z.boolean(),
});

function unwrapRpcRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDigitalDeliveryAccessBlock({
  fileCount,
  accessUrl,
}: {
  fileCount: number;
  accessUrl: string;
}) {
  const count = z.number().int().positive().parse(fileCount);
  const url = z.string().url().parse(accessUrl);
  const fileLabel = `${count} digital ${count === 1 ? "file" : "files"}`;
  const heading = "Your digital files are ready";
  const detail = `${fileLabel} are included with this order. This secure access link expires in ${DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours} hours. The included personal use license applies.`;
  return {
    text: `${heading}\n\n${detail}\n\nAccess your files: ${url}`,
    html: [
      '<div style="margin:24px 0 0;padding:20px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">',
      `<h2 style="margin:0 0 8px;font-size:20px;line-height:28px;">${heading}</h2>`,
      `<p style="margin:0 0 16px;font-size:15px;line-height:24px;">${escapeHtml(detail)}</p>`,
      `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;">Access your files</a>`,
      "</div>",
    ].join(""),
  };
}

function appendDigitalDeliveryAccess(
  message: PreparedOrderEmailMessage,
  block: ReturnType<typeof buildDigitalDeliveryAccessBlock>,
): PreparedOrderEmailMessage {
  const closing = "</td></tr></table></td></tr></table></body></html>";
  const html = message.html.includes(closing)
    ? message.html.replace(
        closing,
        `</td></tr><tr><td style="padding:0 24px 28px;">${block.html}</td></tr></table></td></tr></table></body></html>`,
      )
    : `${message.html}${block.html}`;
  return {
    ...message,
    text: `${message.text}\n\n${block.text}`,
    html,
  };
}

export function sanitizeDigitalDeliveryNotificationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const safe = raw
    .replace(/authorization\s*:\s*bearer\s+\S+/gi, "authorization: [redacted]")
    .replace(/\b(?:RESEND_API_KEY|DIGITAL_DELIVERY_[A-Z_]*SECRET)\s*=\s*\S+/gi, "[credential redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/https?:\/\/[^\s]+\/downloads\/[^\s]+/gi, "[download link redacted]")
    .replace(/\b(?:private|digital-product-assets)\/[^\s]+/gi, "[storage path redacted]")
    .replace(/\b(?:request\s+)?req_[A-Za-z0-9_-]+\b/gi, "[provider detail redacted]")
    .trim()
    .slice(0, 500);
  return safe || "Digital delivery notification failed";
}

export function deriveDigitalResendAccessToken({
  notificationId,
  nonce,
  secret,
}: {
  notificationId: string;
  nonce: string;
  secret: string;
}) {
  return createHmac("sha256", secret)
    .update(`merchant-resend-v1:${notificationId}:${nonce}`)
    .digest("base64url");
}

export function resolveDigitalDeliveryNotificationAccessToken(
  claim: Pick<
    DigitalDeliveryNotificationClaim,
    | "id"
    | "deliveryJobId"
    | "notificationType"
    | "tokenDerivationNonce"
  >,
  secret: string,
) {
  if (claim.notificationType === "purchase") {
    return claim.deliveryJobId && claim.tokenDerivationNonce
      ? deriveDigitalAccessToken({
          jobId: claim.deliveryJobId,
          nonce: claim.tokenDerivationNonce,
          secret,
        })
      : null;
  }
  if (claim.notificationType === "customer_recovery") {
    if (!claim.tokenDerivationNonce) return null;
    return deriveCustomerRecoveryAccessToken({
      notificationId: claim.id,
      nonce: claim.tokenDerivationNonce,
      secret,
    });
  }
  if (claim.notificationType !== "merchant_resend" || !claim.tokenDerivationNonce) {
    return null;
  }
  return deriveDigitalResendAccessToken({
    notificationId: claim.id,
    nonce: claim.tokenDerivationNonce,
    secret,
  });
}

async function buildDefaultMessage(
  claim: DigitalDeliveryNotificationClaim,
): Promise<PreparedOrderEmailMessage> {
  if (claim.notificationType === "refund") {
    if (!claim.refundId || !claim.financialStatus) throw new Error("Refund notification context is unavailable");
    const message = await prepareOrderRefundNotificationEmail(
      claim.orderId,
      claim.refundId,
      claim.financialStatus,
    );
    if (!message) throw new Error("Refund notification context is unavailable");
    return message;
  }
  if (claim.notificationType === "dispute") {
    if (!claim.disputeId || !claim.financialStatus) throw new Error("Dispute notification context is unavailable");
    const message = await prepareOrderDisputeNotificationEmail(
      claim.orderId,
      claim.disputeId,
      claim.financialStatus as Parameters<typeof prepareOrderDisputeNotificationEmail>[2],
    );
    if (!message) throw new Error("Dispute notification context is unavailable");
    return message;
  }
  const secret = getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error("Digital delivery token configuration is unavailable");
  }
  const accessToken = resolveDigitalDeliveryNotificationAccessToken(
    claim,
    secret,
  );
  if (!accessToken || hashDigitalAccessToken(accessToken) !== claim.tokenHash) {
    throw new Error("Digital delivery token integrity check failed");
  }
  const accessUrl = `${getExternalAppUrl().replace(/\/$/, "")}/downloads/${accessToken}`;
  if (claim.notificationType !== "purchase") {
    const recovery = await prepareDigitalAccessRecoveryEmail(
      claim.orderId,
      accessUrl,
    );
    if (!recovery) {
      throw new Error("Digital delivery email context is unavailable");
    }
    return recovery;
  }
  const block = buildDigitalDeliveryAccessBlock({
    fileCount: claim.fileCount,
    accessUrl,
  });
  const base = await prepareDigitalDeliveryOrderConfirmationEmail(
    claim.orderId,
    {
      fileCount: claim.fileCount,
      accessWindowCopy: `This secure access link expires in ${DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours} hours.`,
      accessPageUrl: accessUrl,
    },
  );
  if (!base) {
    throw new Error("Digital delivery email context is unavailable");
  }
  return appendDigitalDeliveryAccess(base, block);
}

async function sendDefaultEmail(
  message: PreparedOrderEmailMessage,
  idempotencyKey: string,
) {
  return sendTransactionalEmail({ ...message, idempotencyKey });
}

export async function claimDigitalDeliveryNotification(
  notificationId: string | undefined,
  client: DigitalDeliveryNotificationRpcClient = createSupabaseAdminClient(),
): Promise<DigitalDeliveryNotificationClaim | null> {
  const { data, error } = await client.rpc("claim_digital_delivery_notification", {
    p_notification_id: notificationId ?? null,
    p_lease_seconds: DIGITAL_PRODUCT_CONFIG.deliveryLeaseSeconds,
    p_max_attempts: DIGITAL_PRODUCT_CONFIG.deliveryMaxAttempts,
  });
  if (error) {
    throw new Error(error.message || "Digital delivery notification claim failed");
  }
  const row = unwrapRpcRow(data);
  if (!row) return null;
  const parsed = claimSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error("Digital delivery notification claim returned an invalid result");
  }
  return {
    id: parsed.data.id,
    storeId: parsed.data.store_id,
    orderId: parsed.data.order_id,
    deliveryJobId: parsed.data.delivery_job_id,
    accessTokenId: parsed.data.access_token_id,
    notificationType: parsed.data.notification_type,
    leaseToken: parsed.data.lease_token,
    attemptNumber: parsed.data.attempt_number,
    tokenDerivationNonce: parsed.data.token_derivation_nonce,
    tokenHash: parsed.data.token_hash,
    fileCount: parsed.data.file_count,
    refundId: parsed.data.refund_id,
    disputeId: parsed.data.dispute_id,
    financialStatus: parsed.data.financial_status,
  };
}

export async function completeDigitalDeliveryNotification(
  {
    claim,
    outcome,
    provider,
    safeError,
  }: {
    claim: DigitalDeliveryNotificationClaim;
    outcome: "succeeded" | "failed";
    provider: "resend";
    safeError: string | null;
  },
  client: DigitalDeliveryNotificationRpcClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("complete_digital_delivery_notification", {
    p_notification_id: claim.id,
    p_lease_token: claim.leaseToken,
    p_outcome: outcome,
    p_provider: provider,
    p_safe_error: safeError,
    p_max_attempts: DIGITAL_PRODUCT_CONFIG.deliveryMaxAttempts,
    p_retry_base_seconds: DIGITAL_PRODUCT_CONFIG.deliveryRetryBaseSeconds,
    p_retry_max_seconds: DIGITAL_PRODUCT_CONFIG.deliveryRetryMaxSeconds,
  });
  if (error) {
    throw new Error(error.message || "Digital delivery notification completion failed");
  }
  const parsed = completionSchema.safeParse(unwrapRpcRow(data));
  if (!parsed.success) {
    throw new Error("Digital delivery notification completion returned an invalid result");
  }
  return {
    status: parsed.data.status,
    nextAttemptAt: parsed.data.next_attempt_at,
  };
}

function createDefaultDependencies(): DigitalDeliveryNotificationProcessorDependencies {
  return {
    claimNotification: (notificationId) =>
      claimDigitalDeliveryNotification(notificationId),
    buildMessage: buildDefaultMessage,
    sendEmail: sendDefaultEmail,
    completeNotification: (input) => completeDigitalDeliveryNotification(input),
  };
}

export async function processNextDigitalDeliveryNotification(
  dependencies: DigitalDeliveryNotificationProcessorDependencies = createDefaultDependencies(),
  notificationId?: string,
) {
  const claim = await dependencies.claimNotification(notificationId);
  if (!claim) {
    return { status: "idle" as const, notificationId: null, nextAttemptAt: null };
  }

  const provider = "resend" as const;
  try {
    const message = await dependencies.buildMessage(claim);
    const result = await dependencies.sendEmail(
      message,
      claim.notificationType === "refund" || claim.notificationType === "dispute"
        ? `financial-order-notification:${claim.id}`
        : `digital-order-delivery:${claim.id}`,
    );
    if (!result.ok) {
      throw new Error("Digital delivery email provider failed");
    }
    const completion = await dependencies.completeNotification({
      claim,
      outcome: "succeeded",
      provider,
      safeError: null,
    });
    return { ...completion, notificationId: claim.id };
  } catch (error) {
    const completion = await dependencies.completeNotification({
      claim,
      outcome: "failed",
      provider,
      safeError: sanitizeDigitalDeliveryNotificationError(error),
    });
    return { ...completion, notificationId: claim.id };
  }
}

export async function preparePurchaseDigitalDeliveryNotification(
  {
    job,
    accessTokenId,
  }: {
    job: DigitalDeliveryJobClaim;
    accessTokenId: string;
  },
  client: DigitalDeliveryNotificationRpcClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc(
    "prepare_purchase_digital_delivery_notification",
    {
      p_job_id: job.id,
      p_lease_token: job.leaseToken,
      p_access_token_id: accessTokenId,
    },
  );
  if (error) {
    throw new Error(error.message || "Digital delivery notification could not be prepared");
  }
  const parsed = preparedNotificationSchema.safeParse(unwrapRpcRow(data));
  if (!parsed.success) {
    throw new Error("Digital delivery notification preparation returned an invalid result");
  }
  return {
    notificationId: parsed.data.notification_id,
    status: parsed.data.status,
  };
}

export async function deliverPurchaseDigitalDeliveryNotification({
  job,
  accessTokenId,
}: {
  job: DigitalDeliveryJobClaim;
  accessTokenId: string;
}) {
  const prepared = await preparePurchaseDigitalDeliveryNotification({
    job,
    accessTokenId,
  });
  if (prepared.status === "succeeded") return;
  const result = await processNextDigitalDeliveryNotification(
    createDefaultDependencies(),
    prepared.notificationId,
  );
  if (result.status !== "succeeded") {
    throw new Error("Digital delivery notification is pending retry");
  }
}

function hashIdempotencyKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function queueMerchantDigitalDeliveryResend({
  orderId,
  storeId,
  actorUserId,
  idempotencyKey,
  tokenSecret,
  client = createSupabaseAdminClient(),
}: {
  orderId: string;
  storeId: string;
  actorUserId: string;
  idempotencyKey: string;
  tokenSecret: string;
  client?: DigitalDeliveryNotificationRpcClient;
}): Promise<
  | {
      ok: true;
      status: "queued";
      duplicate: boolean;
      notificationId: string;
    }
  | { ok: false; reason: "not_found" | "ineligible" }
> {
  const parsed = z
    .object({
      orderId: z.string().uuid(),
      storeId: z.string().uuid(),
      actorUserId: z.string().uuid(),
      idempotencyKey: z.string().trim().min(1).max(128),
      tokenSecret: z.string().min(32),
    })
    .parse({ orderId, storeId, actorUserId, idempotencyKey, tokenSecret });
  const notificationId = randomUUID();
  const accessTokenId = randomUUID();
  const nonce = randomUUID();
  const accessToken = deriveDigitalResendAccessToken({
    notificationId,
    nonce,
    secret: parsed.tokenSecret,
  });
  const { data, error } = await client.rpc(
    "prepare_merchant_digital_delivery_resend",
    {
      p_order_id: parsed.orderId,
      p_store_id: parsed.storeId,
      p_actor_user_id: parsed.actorUserId,
      p_request_key_hash: hashIdempotencyKey(parsed.idempotencyKey),
      p_notification_id: notificationId,
      p_access_token_id: accessTokenId,
      p_token_derivation_nonce: nonce,
      p_token_hash: hashDigitalAccessToken(accessToken),
      p_access_ttl_seconds:
        DIGITAL_PRODUCT_CONFIG.accessLinkTtlHours * 60 * 60,
    },
  );
  if (error) {
    if (error.message?.includes("resend is ineligible")) {
      return { ok: false, reason: "ineligible" };
    }
    if (error.message?.includes("order is unavailable")) {
      return { ok: false, reason: "not_found" };
    }
    throw new Error("Digital delivery resend could not be queued");
  }
  const result = preparedNotificationSchema.safeParse(unwrapRpcRow(data));
  if (!result.success) {
    throw new Error("Digital delivery resend returned an invalid result");
  }
  return {
    ok: true,
    status: "queued",
    duplicate: result.data.duplicate,
    notificationId: result.data.notification_id,
  };
}
