import { z } from "zod";

export const storefrontEventTypes = [
  "page_view",
  "product_view",
  "add_to_cart",
  "cart_view",
  "checkout_started",
  "checkout_completed",
  "newsletter_subscribed",
  "search_performed"
] as const;

const eventSchema = z.object({
  eventType: z.enum(storefrontEventTypes),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  path: z.string().trim().max(512).optional(),
  productId: z.string().uuid().optional(),
  cartId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
  value: z.record(z.string(), z.unknown()).optional()
});

export const collectAnalyticsSchema = z.object({
  storeSlug: z.string().trim().min(2).max(120),
  sessionId: z.string().trim().min(16).max(128).optional(),
  referrer: z.string().trim().max(1024).optional(),
  userAgent: z.string().trim().max(1024).optional(),
  entryPath: z.string().trim().max(512).optional(),
  events: z.array(eventSchema).min(1).max(50)
});

export type CollectAnalyticsPayload = z.infer<typeof collectAnalyticsSchema>;
export type CollectAnalyticsEvent = CollectAnalyticsPayload["events"][number];

export function sanitizeSessionId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length < 16 || normalized.length > 128) {
    return null;
  }
  return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : null;
}

export function dedupeEvents(events: CollectAnalyticsEvent[]): CollectAnalyticsEvent[] {
  const seen = new Set<string>();
  const deduped: CollectAnalyticsEvent[] = [];

  for (const event of events) {
    const key = event.idempotencyKey?.trim();
    if (!key) {
      deduped.push(event);
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}
