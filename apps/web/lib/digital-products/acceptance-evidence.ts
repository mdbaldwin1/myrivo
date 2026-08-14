import { z } from "zod";
import { createHmac } from "node:crypto";

export function hashAcceptanceSession(value: string, key: string) {
  if (key.length < 32) throw new Error("Acceptance evidence redaction key must be at least 32 characters.");
  return createHmac("sha256", key).update("myrivo:digital-acceptance:session:v1\0").update(value).digest("hex");
}

export function assertNoAcceptanceSecrets(value: unknown) {
  const serialized = JSON.stringify(value);
  const forbidden = [/(^|[?&#])token=/i, /cookie[^\n]{0,64}[=:]/i, /[?&](signature|x-amz-signature)=/i, /(^|["'/:])private\//i, /digital_download_session/i];
  if (forbidden.some((pattern) => pattern.test(serialized))) throw new Error("Acceptance evidence contains bearer or private-path material.");
}

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
    refunds: z.array(z.object({ stripe_refund_id: z.string().startsWith("re_"), amount_cents: z.number().int().positive(), status: z.string(), source_event_id: z.string().startsWith("evt_") }).strict()),
    disputes: z.array(z.object({ stripe_dispute_id: z.string().startsWith("dp_"), stripe_charge_id: z.string().startsWith("ch_"), stripe_payment_intent_id: z.string().startsWith("pi_"), status: z.string(), source_event_id: z.string().startsWith("evt_") }).strict()),
    webhookEvents: z.array(z.object({ stripe_event_id: z.string().startsWith("evt_"), event_type: z.string(), status: z.string(), signature_verified: z.boolean(), attempt_count: z.number().int().positive(), last_attempt_at: z.string(), processed_at: z.string().nullable(), created_at: z.string() }).strict()),
    deliveryAttempts: z.array(z.object({ job_id: uuid, attempt_number: z.number().int().positive(), status: z.string(), started_at: z.string(), finished_at: z.string().nullable() }).strict()),
    catalogAssetVersions: z.array(z.object({ id: uuid, current_version_id: uuid, customer_filename: z.string().min(1) }).strict()),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.subjectId !== value.observation.order.id || value.observation.order.stripe_payment_intent_id !== value.observation.providerPayment.id) {
    context.addIssue({ code: "custom", message: "Acceptance evidence identifiers are not correlated." });
  }
});

export type DigitalAcceptanceObservation = z.infer<typeof digitalAcceptanceObservationSchema>;

const webhook = z.object({
  eventId: z.string().startsWith("evt_"), type: z.string().min(1), signatureVerified: z.literal(true),
  status: z.literal("processed"), receivedAt: z.string().datetime(), processedAt: z.string().datetime(), attempts: z.number().int().positive(),
}).strict();
const refundEvidence = z.object({ kind: z.literal("refund"), refundId: z.string().startsWith("re_"), status: z.literal("succeeded"), amount: z.number().int().positive(), paymentIntentId: z.string().startsWith("pi_"), webhook }).strict();
const disputeEvidence = z.object({ kind: z.literal("dispute"), disputeId: z.string().startsWith("dp_"), chargeId: z.string().startsWith("ch_"), paymentIntentId: z.string().startsWith("pi_"), outcome: z.enum(["opened", "won", "lost"]), eventIds: z.array(z.string().startsWith("evt_")).min(1), webhook }).strict();
const resendEvidence = z.object({ kind: z.literal("resend"), messageId: z.string().min(1), status: z.literal("sent"), recipient: z.string().email(), orderId: uuid, accessUrlHash: z.string().regex(/^[a-f0-9]{64}$/), sentAt: z.string().datetime() }).strict();
const checkoutEvidence = z.object({ kind: z.literal("checkout"), sessionId: z.string().startsWith("cs_test_"), paymentIntentId: z.string().startsWith("pi_"), orderId: uuid }).strict();
const grantsEvidence = z.object({ kind: z.literal("grants"), uniqueGrantIds: z.array(uuid).length(5).refine((ids) => new Set(ids).size === 5), graceReusedGrantId: uuid, signingFailureConsumedGrant: z.literal(false), sixthDenied: z.literal(true), sessionHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).length(6).refine((ids) => new Set(ids).size === 6), assetVersionId: uuid }).strict();
const replacementEvidence = z.object({ kind: z.literal("replacement"), priorAssetVersionId: uuid, replacementAssetVersionId: uuid, priorFilename: z.string().min(1), priorContentSha256: z.string().regex(/^[a-f0-9]{64}$/), newCheckoutAssetVersionId: uuid }).strict().refine((value) => value.priorAssetVersionId !== value.replacementAssetVersionId && value.newCheckoutAssetVersionId === value.replacementAssetVersionId);
const deliveryEvidence = z.object({ kind: z.literal("delivery"), jobId: uuid, attempts: z.array(z.object({ attempt: z.number().int().positive(), status: z.enum(["failed", "succeeded"]), timestamp: z.string().datetime() }).strict()).min(2), resendMessageId: z.string().min(1) }).strict();

export const digitalAcceptanceScenarioEvidenceSchema = z.discriminatedUnion("scenario", [
  z.object({ scenario: z.enum(["stripe-digital", "stripe-mixed"]), providerEvidence: checkoutEvidence }).strict(),
  z.object({ scenario: z.enum(["stripe-partial-refund", "stripe-full-refund"]), providerEvidence: refundEvidence }).strict(),
  z.object({ scenario: z.enum(["stripe-dispute-opened", "stripe-dispute-won", "stripe-dispute-lost"]), providerEvidence: disputeEvidence }).strict(),
  z.object({ scenario: z.enum(["resend-access", "merchant-resend"]), providerEvidence: resendEvidence }).strict(),
  z.object({ scenario: z.literal("five-grants"), providerEvidence: grantsEvidence }).strict(),
  z.object({ scenario: z.literal("replacement"), providerEvidence: replacementEvidence }).strict(),
  z.object({ scenario: z.literal("delivery-retry"), providerEvidence: deliveryEvidence }).strict(),
]);
