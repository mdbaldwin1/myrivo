import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_PRODUCT_CONFIG } from "./config";

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type DigitalDeliveryJobRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

const jobSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  order_id: z.string().uuid(),
  manifest_id: z.string().uuid(),
  status: z.enum(["pending", "processing", "succeeded", "failed"]),
});

const claimSchema = jobSchema.extend({
  lease_token: z.string().uuid(),
  attempt_number: z.number().int().positive(),
  notification_sent_at: z.string().datetime({ offset: true }).nullable(),
});

const completionSchema = z.object({
  status: z.enum(["pending", "succeeded", "failed"]),
  next_attempt_at: z.string().datetime({ offset: true }).nullable(),
});

export type DigitalDeliveryJobClaim = {
  id: string;
  storeId: string;
  orderId: string;
  manifestId: string;
  leaseToken: string;
  attemptNumber: number;
  notificationSentAt: string | null;
};

function unwrapRpcRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export async function enqueueDigitalDelivery(
  orderId: string,
  manifestId: string,
  client: DigitalDeliveryJobRpcClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("enqueue_digital_delivery", {
    p_order_id: z.string().uuid().parse(orderId),
    p_manifest_id: z.string().uuid().parse(manifestId),
  });
  if (error) {
    throw new Error(error.message || "Digital delivery could not be queued");
  }
  const parsed = jobSchema.safeParse(unwrapRpcRow(data));
  if (!parsed.success) {
    throw new Error("Digital delivery queue returned an invalid result");
  }
  return {
    id: parsed.data.id,
    storeId: parsed.data.store_id,
    orderId: parsed.data.order_id,
    manifestId: parsed.data.manifest_id,
    status: parsed.data.status,
  };
}

export async function claimDigitalDeliveryJob(
  client: DigitalDeliveryJobRpcClient = createSupabaseAdminClient(),
): Promise<DigitalDeliveryJobClaim | null> {
  const { data, error } = await client.rpc("claim_digital_delivery_job", {
    p_lease_seconds: DIGITAL_PRODUCT_CONFIG.deliveryLeaseSeconds,
    p_max_attempts: DIGITAL_PRODUCT_CONFIG.deliveryMaxAttempts,
  });
  if (error) {
    throw new Error(error.message || "Digital delivery claim failed");
  }
  const row = unwrapRpcRow(data);
  if (!row) return null;
  const parsed = claimSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error("Digital delivery claim returned an invalid result");
  }
  return {
    id: parsed.data.id,
    storeId: parsed.data.store_id,
    orderId: parsed.data.order_id,
    manifestId: parsed.data.manifest_id,
    leaseToken: parsed.data.lease_token,
    attemptNumber: parsed.data.attempt_number,
    notificationSentAt: parsed.data.notification_sent_at,
  };
}

export async function markDigitalDeliveryNotificationSent(
  job: DigitalDeliveryJobClaim,
  client: DigitalDeliveryJobRpcClient = createSupabaseAdminClient(),
) {
  const { error } = await client.rpc("mark_digital_delivery_notification_sent", {
    p_job_id: job.id,
    p_lease_token: job.leaseToken,
  });
  if (error) {
    throw new Error(error.message || "Digital delivery notification could not be recorded");
  }
}

export async function completeDigitalDeliveryJob(
  {
    job,
    outcome,
    safeError = null,
  }: {
    job: DigitalDeliveryJobClaim;
    outcome: "succeeded" | "failed";
    safeError?: string | null;
  },
  client: DigitalDeliveryJobRpcClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("complete_digital_delivery_job", {
    p_job_id: job.id,
    p_lease_token: job.leaseToken,
    p_outcome: outcome,
    p_safe_error: safeError,
    p_max_attempts: DIGITAL_PRODUCT_CONFIG.deliveryMaxAttempts,
    p_retry_base_seconds: DIGITAL_PRODUCT_CONFIG.deliveryRetryBaseSeconds,
    p_retry_max_seconds: DIGITAL_PRODUCT_CONFIG.deliveryRetryMaxSeconds,
  });
  if (error) {
    throw new Error(error.message || "Digital delivery completion failed");
  }
  const parsed = completionSchema.safeParse(unwrapRpcRow(data));
  if (!parsed.success) {
    throw new Error("Digital delivery completion returned an invalid result");
  }
  return {
    status: parsed.data.status,
    nextAttemptAt: parsed.data.next_attempt_at,
  };
}
