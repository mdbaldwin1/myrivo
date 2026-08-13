import { z } from "zod";

const eventTypeSchema = z.enum([
  "upload_failed", "preview_failed", "manifest_failed",
  "delivery_job_aged", "delivery_job_failed", "delivery_email_attempted",
  "access_link_regenerated", "download_signing_failed", "grant_exhausted",
  "reconciliation_mismatch", "refund_transition", "dispute_transition",
]);
const dimensionKeys = [
  "stage", "outcome", "reasonCode", "attemptNumber", "ageBucket",
  "issueType", "composition", "notificationType", "accessState",
  "refundScope", "disputeStatus",
] as const;
const safeDimensionValueSchema = z.union([
  z.string().trim().min(1).max(80).refine(
    (value) => !/(@|https?:\/\/|bearer|authorization|token|[/\\])/i.test(value),
    "Unsafe telemetry dimension value",
  ),
  z.number().int().nonnegative(),
]);
const dimensionsSchema = z.object(Object.fromEntries(
  dimensionKeys.map((key) => [key, safeDimensionValueSchema.optional()]),
)).strict();

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
  const parsedDimensions = dimensionsSchema.safeParse(input.dimensions ?? {});
  if (!parsedDimensions.success) throw new Error("Unsafe digital product telemetry dimensions");
  const dimensions = parsedDimensions.data;
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
