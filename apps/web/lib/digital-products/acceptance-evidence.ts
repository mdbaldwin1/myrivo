import { z } from "zod";

const uuid = z.string().uuid();
const order = z.object({
  id: uuid, store_id: uuid, status: z.string().min(1), payment_status: z.string().nullable(),
  refund_status: z.string().nullable(), dispute_status: z.string().nullable(),
  stripe_payment_intent_id: z.string().startsWith("pi_"), checkout_composition: z.enum(["digital_only", "mixed"]),
}).strict();
const grant = z.object({ id: uuid, status: z.string().min(1), asset_version_id: uuid, created_at: z.string() }).strict();
const notification = z.object({ id: uuid, notification_type: z.string().min(1), status: z.string().min(1), provider: z.string().min(1), attempt_count: z.number().int().nonnegative(), sent_at: z.string().nullable() }).strict();

export const digitalAcceptanceObservationSchema = z.object({
  version: z.literal(1), runId: uuid, subjectId: uuid, observedAt: z.string().datetime(),
  observation: z.object({
    order,
    deliveryJob: z.object({ id: uuid, status: z.string().min(1), attempt_count: z.number().int().nonnegative(), last_safe_error: z.string().nullable() }).strict(),
    grants: z.array(grant), notifications: z.array(notification),
    manifestItems: z.array(z.object({ asset_version_id: uuid, customer_filename: z.string().min(1) }).strict()).min(1),
    providerPayment: z.object({ id: z.string().startsWith("pi_"), status: z.literal("succeeded"), livemode: z.literal(false) }).strict(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.subjectId !== value.observation.order.id || value.observation.order.stripe_payment_intent_id !== value.observation.providerPayment.id) {
    context.addIssue({ code: "custom", message: "Acceptance evidence identifiers are not correlated." });
  }
});

export type DigitalAcceptanceObservation = z.infer<typeof digitalAcceptanceObservationSchema>;
