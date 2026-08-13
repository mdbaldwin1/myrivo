import { z } from "zod";

const eventTypeSchema = z.enum([
  "upload_failed", "preview_failed", "manifest_failed",
  "delivery_job_aged", "delivery_job_failed", "delivery_email_attempted",
  "access_link_regenerated", "download_signing_failed", "grant_exhausted",
  "reconciliation_mismatch", "refund_transition", "dispute_transition",
]);
const attemptNumberSchema = z.number().int().min(0).max(10_000);
const outcomeSchema = z.enum(["queued", "pending", "processing", "succeeded", "failed", "denied"]);
const notificationTypeSchema = z.enum(["purchase", "merchant_resend", "customer_recovery", "refund", "dispute"]);
const reconciliationIssueSchema = z.enum([
  "paid_order_missing_entitlements",
  "full_refund_active_access",
  "open_dispute_access_mismatch",
  "lost_dispute_access_mismatch",
  "token_access_mismatch",
]);
const telemetryDimensionsSchema = z.discriminatedUnion("eventType", [
  z.object({ eventType: z.literal("upload_failed"), dimensions: z.object({ stage: z.enum(["upload", "completion"]), outcome: z.literal("failed") }).strict() }),
  z.object({ eventType: z.literal("preview_failed"), dimensions: z.object({ stage: z.enum(["preview", "completion"]), outcome: z.literal("failed") }).strict() }),
  z.object({ eventType: z.literal("manifest_failed"), dimensions: z.object({ stage: z.literal("checkout_manifest"), outcome: z.literal("failed"), composition: z.enum(["digital_only", "mixed"]) }).strict() }),
  z.object({ eventType: z.literal("delivery_job_aged"), dimensions: z.object({ ageBucket: z.enum(["5m_to_30m", "30m_plus"]) }).strict() }),
  z.object({ eventType: z.literal("delivery_job_failed"), dimensions: z.object({ outcome: z.literal("failed"), attemptNumber: attemptNumberSchema }).strict() }),
  z.object({ eventType: z.literal("delivery_email_attempted"), dimensions: z.object({ notificationType: notificationTypeSchema, outcome: outcomeSchema, attemptNumber: attemptNumberSchema }).strict() }),
  z.object({ eventType: z.literal("access_link_regenerated"), dimensions: z.object({ notificationType: z.enum(["merchant_resend", "customer_recovery"]), outcome: z.literal("queued") }).strict() }),
  z.object({ eventType: z.literal("download_signing_failed"), dimensions: z.object({ stage: z.literal("storage_signing"), outcome: z.literal("failed") }).strict() }),
  z.object({ eventType: z.literal("grant_exhausted"), dimensions: z.object({ stage: z.literal("reservation"), outcome: z.literal("denied") }).strict() }),
  z.object({ eventType: z.literal("reconciliation_mismatch"), dimensions: z.object({ issueType: reconciliationIssueSchema }).strict() }),
  z.object({ eventType: z.literal("refund_transition"), dimensions: z.object({ outcome: z.enum(["requested", "processing", "succeeded", "failed", "cancelled"]) }).strict() }),
  z.object({ eventType: z.literal("dispute_transition"), dimensions: z.object({ disputeStatus: z.enum(["warning_needs_response", "warning_under_review", "warning_closed", "needs_response", "under_review", "won", "lost", "prevented"]) }).strict() }),
]);

type TelemetryClient = {
  from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }> };
};

export async function recordDigitalProductEvent(client: TelemetryClient, input: {
  eventType: z.infer<typeof eventTypeSchema>;
  storeId?: string | null;
  orderId?: string | null;
  productId?: string | null;
  dimensions?: Record<string, string | number>;
}) {
  const eventType = eventTypeSchema.parse(input.eventType);
  const parsedDimensions = telemetryDimensionsSchema.safeParse({
    eventType,
    dimensions: input.dimensions ?? {},
  });
  if (!parsedDimensions.success) throw new Error("Unsafe digital product telemetry dimensions");
  const dimensions = parsedDimensions.data.dimensions;
  const { error } = await client.from("digital_product_events").insert({
    event_type: eventType,
    store_id: input.storeId ?? null,
    order_id: input.orderId ?? null,
    product_id: input.productId ?? null,
    dimensions,
  });
  return !error;
}

export async function recordDigitalProductEventBestEffort(client: TelemetryClient, input: Parameters<typeof recordDigitalProductEvent>[1]) {
  try {
    return await recordDigitalProductEvent(client, input);
  } catch {
    return false;
  }
}
