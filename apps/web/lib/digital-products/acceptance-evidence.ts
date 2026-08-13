import { z } from "zod";

export const digitalAcceptanceObservationSchema = z.object({
  action: z.enum(["observe", "expire-access", "inject-delivery-failure", "inject-refund", "inject-dispute"]),
  orderId: z.string().uuid(), storeId: z.string().uuid(),
  payment: z.object({ id: z.string().startsWith("pi_"), status: z.literal("succeeded"), livemode: z.literal(false) }).strict(),
  delivery: z.object({ id: z.string().uuid(), status: z.enum(["pending", "processing", "succeeded", "failed"]), attemptCount: z.number().int().nonnegative(), providerMessageId: z.string().min(1).nullable().optional() }).strict(),
  manifestVersionIds: z.array(z.string().uuid()).min(1),
  grants: z.array(z.object({ id: z.string().uuid(), status: z.enum(["reserved", "issued", "released"]), assetVersionId: z.string().uuid() }).strict()),
}).strict();
