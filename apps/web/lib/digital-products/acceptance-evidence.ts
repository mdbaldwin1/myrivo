import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DIGITAL_PRODUCT_CONFIG } from "./config.ts";

export function hashAcceptanceSession(value: string, key: string) {
  if (key.length < 32) throw new Error("Acceptance evidence redaction key must be at least 32 characters.");
  return createHmac("sha256", key).update("myrivo:digital-acceptance:session:v1\0").update(value).digest("hex");
}

export function assertNoAcceptanceSecrets(value: unknown) {
  const serialized = JSON.stringify(value);
  const forbidden = [/(^|[?&#])token=/i, /cookie[^\n]{0,64}[=:]/i, /[?&](signature|x-amz-signature)=/i, /(^|["'/:])private\//i, /digital_download_session/i, /bearer\s+[a-z0-9._-]+/i, /"apiKey"\s*:\s*"[^" ]+/i, /\b(sk_(live|test)|rk_live|whsec_)[a-z0-9_]+/i];
  if (forbidden.some((pattern) => pattern.test(serialized))) throw new Error("Acceptance evidence contains bearer or private-path material.");
}

const uuid = z.string().uuid();
const order = z.object({
  id: uuid, store_id: uuid, status: z.string().min(1), payment_status: z.string().nullable(),
  refund_status: z.string().nullable(), dispute_status: z.string().nullable(),
  stripe_payment_intent_id: z.string().startsWith("pi_"), checkout_composition: z.enum(["digital_only", "mixed"]),
}).strict();
const grant = z.object({ id: uuid, entitlement_id: uuid, status: z.enum(["reserved", "issued", "released", "failed"]), asset_version_id: uuid, created_at: z.string(), released_at: z.string().nullable(), last_safe_error: z.string().nullable() }).strict();
const notification = z.object({ id: uuid, notification_type: z.string().min(1), status: z.string().min(1), provider: z.string().min(1), provider_message_id: z.string().nullable(), attempt_count: z.number().int().nonnegative(), sent_at: z.string().nullable() }).strict();

export const digitalAcceptanceObservationSchema = z.object({
  version: z.literal(1), runId: uuid, subjectId: uuid, observedAt: z.string().datetime(),
  observation: z.object({
    order,
    deliveryJob: z.object({ id: uuid, status: z.string().min(1), attempt_count: z.number().int().nonnegative(), last_safe_error: z.string().nullable() }).strict(),
    grants: z.array(grant), notifications: z.array(notification),
    entitlements: z.array(z.object({ id: uuid, asset_version_id: uuid, download_grants_used: z.number().int().nonnegative(), customer_filename: z.string().min(1), status: z.string() }).strict()).min(1),
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
const grantIds = z.array(uuid);
const downloadLimitContract = DIGITAL_PRODUCT_CONFIG.downloadLimitResponse;
const grantsEvidence = z.object({ kind: z.literal("grants"), uniqueGrantIds: grantIds.length(DIGITAL_PRODUCT_CONFIG.grantsPerFile).refine((ids) => new Set(ids).size === DIGITAL_PRODUCT_CONFIG.grantsPerFile), graceReusedGrantId: uuid, graceCountBefore: z.number().int().nonnegative(), graceCountAfter: z.number().int().nonnegative(), signingFailureIssuedIdsBefore: grantIds, signingFailureIssuedIdsAfter: grantIds, signingFailureUsedBefore: z.number().int().nonnegative(), signingFailureUsedAfter: z.number().int().nonnegative(), releasedFaultGrantId: uuid, successfulRetryGrantId: uuid, sixthDeniedStatus: z.literal(downloadLimitContract.status), sixthDeniedCode: z.literal(downloadLimitContract.code), sixthDeniedMessage: z.literal(downloadLimitContract.message), sessionHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).length(DIGITAL_PRODUCT_CONFIG.grantsPerFile + 1).refine((ids) => new Set(ids).size === DIGITAL_PRODUCT_CONFIG.grantsPerFile + 1), assetVersionId: uuid }).strict().superRefine((value, context) => {
  if (value.graceCountBefore !== value.graceCountAfter || !value.uniqueGrantIds.includes(value.graceReusedGrantId)) context.addIssue({ code: "custom", message: "Grace reuse consumed a grant or changed identity." });
  if (JSON.stringify(value.signingFailureIssuedIdsBefore) !== JSON.stringify(value.signingFailureIssuedIdsAfter) || value.signingFailureUsedBefore !== value.signingFailureUsedAfter) context.addIssue({ code: "custom", message: "Signing failure changed issued usage." });
});
const replacementEvidence = z.object({ kind: z.literal("replacement"), priorAssetVersionId: uuid, replacementAssetVersionId: uuid, oldBeforeFilename: z.string().min(1), oldAfterFilename: z.string().min(1), newFilename: z.string().min(1), oldBeforeHash: z.string().regex(/^[a-f0-9]{64}$/), oldAfterHash: z.string().regex(/^[a-f0-9]{64}$/), newHash: z.string().regex(/^[a-f0-9]{64}$/), newCheckoutAssetVersionId: uuid, newCheckoutOrderId: uuid }).strict().refine((value) => value.priorAssetVersionId !== value.replacementAssetVersionId && value.newCheckoutAssetVersionId === value.replacementAssetVersionId && value.oldBeforeHash === value.oldAfterHash && value.oldBeforeHash !== value.newHash && value.oldBeforeFilename === value.oldAfterFilename);
const deliveryEvidence = z.object({ kind: z.literal("delivery"), jobId: uuid, attempts: z.array(z.object({ attempt: z.number().int().positive(), status: z.enum(["failed", "succeeded"]), startedAt: z.string().datetime(), finishedAt: z.string().datetime() }).strict()).min(2), resendMessageId: z.string().min(1), resendSentAt: z.string().datetime() }).strict().superRefine((value, context) => {
  value.attempts.forEach((attempt, index) => {
    if (attempt.attempt !== index + 1 || Date.parse(attempt.finishedAt) < Date.parse(attempt.startedAt) || (index > 0 && Date.parse(attempt.startedAt) < Date.parse(value.attempts[index - 1]!.finishedAt))) context.addIssue({ code: "custom", message: "Delivery attempts are not an ordered chronology." });
  });
});

export const digitalAcceptanceScenarioEvidenceSchema = z.discriminatedUnion("scenario", [
  z.object({ scenario: z.enum(["stripe-digital", "stripe-mixed"]), providerEvidence: checkoutEvidence }).strict(),
  z.object({ scenario: z.enum(["stripe-partial-refund", "stripe-full-refund"]), providerEvidence: refundEvidence }).strict(),
  z.object({ scenario: z.enum(["stripe-dispute-opened", "stripe-dispute-won", "stripe-dispute-lost"]), providerEvidence: disputeEvidence }).strict(),
  z.object({ scenario: z.enum(["resend-access", "merchant-resend"]), providerEvidence: resendEvidence }).strict(),
  z.object({ scenario: z.literal("five-grants"), providerEvidence: grantsEvidence }).strict(),
  z.object({ scenario: z.literal("replacement"), providerEvidence: replacementEvidence }).strict(),
  z.object({ scenario: z.literal("delivery-retry"), providerEvidence: deliveryEvidence }).strict(),
]);

export const digitalAcceptanceSignedEvidenceSchema = z.object({
  schemaVersion: z.literal(3), runId: uuid, origin: z.string().url(), releaseVersion: z.string().min(1),
  environment: z.enum(["test", "preview"]), startedAt: z.string().datetime(), completedAt: z.string().datetime(),
  observations: z.array(z.object({ action: z.literal("observe"), transition: z.undefined().optional() }).passthrough()).min(1),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((value, context) => {
  const scenarios = new Set<string>();
  value.observations.forEach((record, index) => {
    const parsed = digitalAcceptanceScenarioEvidenceSchema.safeParse({ scenario: record.scenario, providerEvidence: record.providerEvidence });
    const observation = digitalAcceptanceObservationSchema.safeParse({ version: record.version, runId: record.runId, subjectId: record.subjectId, observedAt: record.observedAt, observation: record.observation });
    const newObservation = record.scenario === "replacement" ? digitalAcceptanceObservationSchema.safeParse(record.newObservation) : null;
    if (!parsed.success || !observation.success || (newObservation && !newObservation.success)) context.addIssue({ code: "custom", path: ["observations", index], message: "Invalid canonical scenario observation." });
    else if (scenarios.has(parsed.data.scenario)) context.addIssue({ code: "custom", path: ["observations", index], message: "Duplicate scenario." });
    else scenarios.add(parsed.data.scenario);
  });
});

export type DigitalAcceptanceVerificationOptions = {
  requiredScenarios?: string[];
  expectedRunId?: string;
  expectedOrigin?: string;
  expectedReleaseVersion?: string;
  expectedRecipient?: string;
  expectedScenarioSubjects?: Record<string, string | undefined>;
};

export function verifyDigitalAcceptanceEvidence(input: unknown, options: DigitalAcceptanceVerificationOptions = {}) {
  const evidence = digitalAcceptanceSignedEvidenceSchema.parse(input);
  if (options.expectedRunId && evidence.runId !== options.expectedRunId) throw new Error("Acceptance evidence run mismatch.");
  if (options.expectedOrigin && evidence.origin !== options.expectedOrigin) throw new Error("Acceptance evidence origin mismatch.");
  if (options.expectedReleaseVersion && evidence.releaseVersion !== options.expectedReleaseVersion) throw new Error("Acceptance evidence release mismatch.");
  const records = evidence.observations as Array<Record<string, unknown>>;
  const byScenario = new Map(records.map((record) => [String(record.scenario), record]));
  for (const scenario of options.requiredScenarios ?? []) if (!byScenario.has(scenario)) throw new Error(`Missing required scenario: ${scenario}`);
  for (const record of records) {
    const provider = record.providerEvidence as Record<string, unknown>;
    const observed = (record.observation as Record<string, unknown>);
    const order = observed.order as Record<string, unknown>;
    const payment = observed.providerPayment as Record<string, unknown>;
    if (record.runId !== evidence.runId) throw new Error(`Scenario ${record.scenario} run mismatch.`);
    const expectedSubject = options.expectedScenarioSubjects?.[String(record.scenario)];
    if (expectedSubject && record.subjectId !== expectedSubject) throw new Error(`Scenario ${record.scenario} fixture subject mismatch.`);
    if (record.subjectId !== order.id) throw new Error(`Scenario ${record.scenario} order mismatch.`);
    if (["checkout", "refund", "dispute"].includes(String(provider.kind)) && provider.paymentIntentId !== payment.id) throw new Error(`Scenario ${record.scenario} payment mismatch.`);
    if (provider.kind === "checkout" && provider.orderId !== order.id) throw new Error(`Scenario ${record.scenario} checkout order mismatch.`);
    if (provider.kind === "checkout") {
      const expectedComposition = record.scenario === "stripe-digital" ? "digital_only" : "mixed";
      if (order.checkout_composition !== expectedComposition || !(observed.manifestItems as unknown[])?.length) throw new Error(`Scenario ${record.scenario} checkout composition or manifest mismatch.`);
    }
    if (provider.kind === "resend") {
      const notifications = observed.notifications as Array<Record<string, unknown>>;
      if ((options.expectedRecipient && provider.recipient !== options.expectedRecipient) || provider.orderId !== order.id || !notifications.some((notification) => notification.provider === "resend" && notification.provider_message_id === provider.messageId && notification.status === "succeeded" && notification.sent_at === provider.sentAt)) throw new Error(`Scenario ${record.scenario} Resend recipient or persisted evidence mismatch.`);
    }
    if (provider.kind === "refund") {
      const refunds = observed.refunds as Array<Record<string, unknown>>;
      const row = refunds.find((refund) => refund.stripe_refund_id === provider.refundId);
      const webhook = provider.webhook as Record<string, unknown>;
      const events = observed.webhookEvents as Array<Record<string, unknown>>;
      if (!row || row.amount_cents !== provider.amount || row.status !== provider.status || row.source_event_id !== webhook.eventId || !events.some((event) => event.stripe_event_id === webhook.eventId && event.event_type === webhook.type && event.status === webhook.status && event.signature_verified === webhook.signatureVerified && event.attempt_count === webhook.attempts)) throw new Error(`Scenario ${record.scenario} refund mismatch.`);
      const entitlements = observed.entitlements as Array<Record<string, unknown>>;
      if (record.scenario === "stripe-full-refund" && entitlements.some((entitlement) => entitlement.status !== "revoked")) throw new Error("Full refund access was not revoked.");
      if (record.scenario === "stripe-partial-refund" && entitlements.some((entitlement) => entitlement.status !== "active")) throw new Error("Partial refund access was not retained.");
    }
    if (provider.kind === "dispute") {
      const disputes = observed.disputes as Array<Record<string, unknown>>;
      const row = disputes.find((dispute) => dispute.stripe_dispute_id === provider.disputeId);
      const webhook = provider.webhook as Record<string, unknown>;
      const events = observed.webhookEvents as Array<Record<string, unknown>>;
      const expectedStatus = provider.outcome === "opened" ? "needs_response" : provider.outcome;
      const expectedAccess = provider.outcome === "opened" ? "suspended" : provider.outcome === "won" ? "active" : "revoked";
      if (!row || row.stripe_charge_id !== provider.chargeId || row.stripe_payment_intent_id !== provider.paymentIntentId || row.status !== expectedStatus || row.source_event_id !== webhook.eventId || !(provider.eventIds as string[]).includes(String(webhook.eventId)) || !events.some((event) => event.stripe_event_id === webhook.eventId && event.event_type === webhook.type && event.status === webhook.status && event.signature_verified === webhook.signatureVerified && event.attempt_count === webhook.attempts) || (observed.entitlements as Array<Record<string, unknown>>).some((entitlement) => entitlement.status !== expectedAccess)) throw new Error(`Scenario ${record.scenario} dispute mismatch.`);
    }
    if (provider.kind === "grants") {
      const grants = observed.grants as Array<Record<string, unknown>>;
      const issued = grants.filter((grant) => grant.status === "issued").map((grant) => String(grant.id)).sort();
      const claimed = (provider.uniqueGrantIds as string[]).slice().sort();
      const released = grants.filter((grant) => grant.id === provider.releasedFaultGrantId && grant.status === "released" && typeof grant.released_at === "string" && typeof grant.last_safe_error === "string" && grant.last_safe_error.length > 0);
      const retry = grants.find((grant) => grant.id === provider.successfulRetryGrantId && grant.status === "issued");
      if (JSON.stringify(issued) !== JSON.stringify(claimed) || provider.sixthDeniedStatus !== downloadLimitContract.status || provider.sixthDeniedCode !== downloadLimitContract.code || provider.sixthDeniedMessage !== downloadLimitContract.message || provider.sessionHashes instanceof Array === false || new Set(provider.sessionHashes as string[]).size !== DIGITAL_PRODUCT_CONFIG.grantsPerFile + 1 || grants.some((grant) => grant.asset_version_id !== provider.assetVersionId) || released.length !== 1 || !retry || Date.parse(String(retry.created_at)) <= Date.parse(String(released[0]?.released_at))) throw new Error("Grant evidence mismatch.");
    }
    if (provider.kind === "replacement") {
      const entitlements = observed.entitlements as Array<Record<string, unknown>>;
      const manifest = observed.manifestItems as Array<Record<string, unknown>>;
      const catalog = observed.catalogAssetVersions as Array<Record<string, unknown>>;
      const next = (record.newObservation as Record<string, unknown>)?.observation as Record<string, unknown>;
      const nextOrder = next?.order as Record<string, unknown>;
      const nextManifest = next?.manifestItems as Array<Record<string, unknown>>;
      if (!entitlements.some((entitlement) => entitlement.asset_version_id === provider.priorAssetVersionId && entitlement.customer_filename === provider.oldAfterFilename) || !manifest.some((item) => item.asset_version_id === provider.priorAssetVersionId && item.customer_filename === provider.oldBeforeFilename) || manifest.some((item) => item.asset_version_id === provider.replacementAssetVersionId) || nextOrder?.id !== provider.newCheckoutOrderId || !nextManifest?.some((item) => item.asset_version_id === provider.newCheckoutAssetVersionId && item.customer_filename === provider.newFilename) || !catalog.some((asset) => asset.current_version_id === provider.replacementAssetVersionId && asset.customer_filename === provider.newFilename)) throw new Error("Replacement evidence mismatch.");
    }
    if (provider.kind === "delivery") {
      const job = observed.deliveryJob as Record<string, unknown>;
      const attempts = provider.attempts as Array<Record<string, unknown>>;
      const observedAttempts = observed.deliveryAttempts as Array<Record<string, unknown>>;
      const notification = (observed.notifications as Array<Record<string, unknown>>).find((item) => item.provider_message_id === provider.resendMessageId);
      if (provider.jobId !== job.id || job.status !== "succeeded" || job.attempt_count !== attempts.length || attempts[0]?.status !== "failed" || attempts.at(-1)?.status !== "succeeded" || attempts.length !== observedAttempts.length || attempts.some((attempt, index) => observedAttempts[index]?.job_id !== provider.jobId || attempt.attempt !== observedAttempts[index]?.attempt_number || attempt.status !== observedAttempts[index]?.status || attempt.startedAt !== observedAttempts[index]?.started_at || attempt.finishedAt !== observedAttempts[index]?.finished_at) || !notification || notification.notification_type !== "merchant_resend" || notification.status !== "succeeded" || notification.provider !== "resend" || notification.sent_at !== provider.resendSentAt) throw new Error("Delivery chronology or persisted resend mismatch.");
    }
  }
  return evidence;
}

export function verifyDigitalAcceptanceArtifact(input: unknown, options: { key: string; now?: number; maxAgeMs?: number } & DigitalAcceptanceVerificationOptions) {
  if (options.key.length < 32) throw new Error("Acceptance evidence signing key is invalid.");
  assertNoAcceptanceSecrets(input);
  const candidate = digitalAcceptanceSignedEvidenceSchema.parse(input);
  const unsigned = { ...candidate } as Record<string, unknown>;
  const signature = String(unsigned.signature);
  delete unsigned.signature;
  const expected = createHmac("sha256", options.key).update(JSON.stringify(unsigned)).digest("hex");
  const suppliedBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) throw new Error("Acceptance evidence signature is invalid.");
  const now = options.now ?? Date.now();
  const completedAt = Date.parse(candidate.completedAt);
  const startedAt = Date.parse(candidate.startedAt);
  if (completedAt < startedAt || completedAt > now + 5 * 60_000 || now - completedAt > (options.maxAgeMs ?? 60 * 60_000)) throw new Error("Acceptance evidence is stale or has invalid chronology.");
  return verifyDigitalAcceptanceEvidence(candidate, options);
}
