import { getServerEnv } from "@/lib/env";
import { DIGITAL_PRODUCT_CONFIG } from "./config";
import {
  deliverPurchaseDigitalDeliveryNotification,
  processNextDigitalDeliveryNotification,
} from "./delivery-email";
import {
  claimDigitalDeliveryJob,
  completeDigitalDeliveryJob,
  markDigitalDeliveryNotificationSent,
  type DigitalDeliveryJobClaim,
} from "./delivery-jobs";
import {
  materializeEntitlementsFromManifest,
  type DigitalEntitlementMaterialization,
} from "./entitlements";

type DeliveryCompletion = {
  status: "pending" | "succeeded" | "failed";
  nextAttemptAt: string | null;
};

export type DigitalDeliveryWorkerDependencies = {
  claimJob: () => Promise<DigitalDeliveryJobClaim | null>;
  materializeEntitlements: (
    job: DigitalDeliveryJobClaim,
  ) => Promise<DigitalEntitlementMaterialization>;
  sendNotification: (input: {
    job: DigitalDeliveryJobClaim;
    delivery: DigitalEntitlementMaterialization;
    idempotencyKey: string;
  }) => Promise<void>;
  markNotificationSent: (job: DigitalDeliveryJobClaim) => Promise<void>;
  completeJob: (input: {
    job: DigitalDeliveryJobClaim;
    outcome: "succeeded" | "failed";
    safeError?: string | null;
  }) => Promise<DeliveryCompletion>;
};

export function sanitizeDigitalDeliveryError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Digital delivery failed";
  const safe = raw
    .replace(/authorization\s*:\s*bearer\s+\S+/gi, "authorization: [redacted]")
    .replace(/\b(?:RESEND_API_KEY|DIGITAL_DELIVERY_[A-Z_]*SECRET)\s*=\s*\S+/gi, "[credential redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/https?:\/\/[^\s]+\/downloads\/[^\s]+/gi, "[download link redacted]")
    .trim()
    .slice(0, 500);
  return safe || "Digital delivery failed";
}

function createDefaultDependencies(): DigitalDeliveryWorkerDependencies {
  return {
    claimJob: () => claimDigitalDeliveryJob(),
    materializeEntitlements: (job) => {
      const tokenSecret = getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET;
      if (!tokenSecret) {
        throw new Error("Digital delivery token configuration is unavailable");
      }
      return materializeEntitlementsFromManifest({ job, tokenSecret });
    },
    sendNotification: ({ job, delivery }) =>
      deliverPurchaseDigitalDeliveryNotification({
        job,
        accessTokenId: delivery.accessTokenId,
      }),
    markNotificationSent: (job) => markDigitalDeliveryNotificationSent(job),
    completeJob: (input) => completeDigitalDeliveryJob(input),
  };
}

export async function processNextDigitalDelivery(
  dependencies: DigitalDeliveryWorkerDependencies = createDefaultDependencies(),
) {
  const job = await dependencies.claimJob();
  if (!job) {
    return { status: "idle" as const, jobId: null, nextAttemptAt: null };
  }

  try {
    const delivery = await dependencies.materializeEntitlements(job);
    if (!job.notificationSentAt) {
      await dependencies.sendNotification({
        job,
        delivery,
        idempotencyKey: `digital-delivery:${job.id}`,
      });
      await dependencies.markNotificationSent(job);
    }
    const completion = await dependencies.completeJob({
      job,
      outcome: "succeeded",
    });
    return { ...completion, jobId: job.id };
  } catch (error) {
    const completion = await dependencies.completeJob({
      job,
      outcome: "failed",
      safeError: sanitizeDigitalDeliveryError(error),
    });
    return { ...completion, jobId: job.id };
  }
}

type BatchWorkResult = {
  status: "idle" | "pending" | "succeeded" | "failed";
  nextAttemptAt: string | null;
};

export type DigitalDeliveryBatchDependencies = {
  processJob: () => Promise<BatchWorkResult>;
  processNotification: (options?: {
    includeAccessNotifications: boolean;
  }) => Promise<BatchWorkResult>;
};

function createDefaultBatchDependencies(): DigitalDeliveryBatchDependencies {
  return {
    processJob: () => processNextDigitalDelivery(),
    processNotification: (options) =>
      processNextDigitalDeliveryNotification(undefined, undefined, options),
  };
}

export async function processDigitalDeliveryBatch(
  dependencies?: DigitalDeliveryBatchDependencies,
  options: { tokenSecretConfigured?: boolean } = {},
) {
  const resolvedDependencies =
    dependencies ?? createDefaultBatchDependencies();
  const tokenSecretConfigured =
    options.tokenSecretConfigured ??
    (dependencies
      ? true
      : Boolean(getServerEnv().DIGITAL_DELIVERY_TOKEN_SECRET?.trim()));
  const configurationIssues = tokenSecretConfigured
    ? []
    : ["digital_delivery_token_unconfigured"];
  let claimed = 0;
  let succeeded = 0;
  let retrying = 0;
  let failed = 0;
  let preferNotification = false;

  for (
    let index = 0;
    index < DIGITAL_PRODUCT_CONFIG.deliveryProcessBatchSize;
    index += 1
  ) {
    if (!tokenSecretConfigured) {
      const result = await resolvedDependencies.processNotification({
        includeAccessNotifications: false,
      });
      if (result.status === "idle") break;
      claimed += 1;
      if (result.status === "succeeded") succeeded += 1;
      else if (result.status === "pending") retrying += 1;
      else failed += 1;
      continue;
    }
    const primary = preferNotification
      ? resolvedDependencies.processNotification
      : resolvedDependencies.processJob;
    const secondary = preferNotification
      ? resolvedDependencies.processJob
      : resolvedDependencies.processNotification;
    let result = await primary();
    if (result.status === "idle") {
      result = await secondary();
    }
    if (result.status === "idle") break;
    claimed += 1;
    if (result.status === "succeeded") succeeded += 1;
    else if (result.status === "pending") retrying += 1;
    else failed += 1;
    preferNotification = !preferNotification;
  }

  return { claimed, succeeded, retrying, failed, configurationIssues };
}
