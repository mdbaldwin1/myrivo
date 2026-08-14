/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial fixture intentionally permits deep mutation */
const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const at = (seconds: number) => new Date(Date.UTC(2026, 7, 13, 12, 0, seconds)).toISOString();

export const requiredDigitalAcceptanceScenarios = [
  "stripe-digital", "stripe-mixed", "resend-access", "five-grants", "replacement",
  "stripe-partial-refund", "stripe-full-refund", "stripe-dispute-opened", "stripe-dispute-won",
  "stripe-dispute-lost", "delivery-retry", "merchant-resend",
] as const;

export function buildDigitalAcceptanceEvidenceFixture() {
  let sequence = 1;
  const nextId = () => uuid(sequence++);
  const runId = nextId();
  const makeObservation = (composition: "digital_only" | "mixed" = "digital_only"): any => {
    const orderId = nextId(), storeId = nextId(), entitlementId = nextId(), versionId = nextId(), jobId = nextId();
    const paymentIntentId = `pi_${sequence++}`;
    return {
      version: 1, runId, subjectId: orderId, observedAt: at(sequence++),
      observation: {
        order: { id: orderId, store_id: storeId, status: "paid", payment_status: "paid", refund_status: null, dispute_status: null, stripe_payment_intent_id: paymentIntentId, checkout_composition: composition },
        deliveryJob: { id: jobId, status: "succeeded", attempt_count: 1, last_safe_error: null },
        grants: [], notifications: [],
        entitlements: [{ id: entitlementId, asset_version_id: versionId, download_grants_used: 0, customer_filename: "art.png", status: "active" }],
        manifestItems: [{ asset_version_id: versionId, customer_filename: "art.png" }],
        providerPayment: { id: paymentIntentId, status: "succeeded", livemode: false },
        refunds: [], disputes: [], webhookEvents: [], deliveryAttempts: [],
        catalogAssetVersions: [{ id: nextId(), current_version_id: versionId, customer_filename: "art.png" }],
      },
    };
  };
  const record = (scenario: string, providerEvidence: Record<string, unknown>, base = makeObservation()) => ({ action: "observe", scenario, providerEvidence, ...base });
  const digital = makeObservation();
  const mixed = makeObservation("mixed");
  const resend = makeObservation();
  const resendSentAt = at(sequence++);
  resend.observation.notifications.push({ id: nextId(), notification_type: "purchase", status: "succeeded", provider: "resend", provider_message_id: "email_access", attempt_count: 1, sent_at: resendSentAt });
  const grants = makeObservation();
  const grantIds = Array.from({ length: 5 }, () => nextId());
  const grantVersion = grants.observation.entitlements[0].asset_version_id;
  const releasedFaultGrantId = nextId();
  const releasedAt = at(sequence++);
  grants.observation.grants = [
    ...grantIds.slice(0, 4).map((id) => ({ id, entitlement_id: grants.observation.entitlements[0].id, status: "issued", asset_version_id: grantVersion, created_at: at(sequence++), released_at: null, last_safe_error: null })),
    { id: releasedFaultGrantId, entitlement_id: grants.observation.entitlements[0].id, status: "released", asset_version_id: grantVersion, created_at: releasedAt, released_at: releasedAt, last_safe_error: "Storage signing failed" },
    { id: grantIds[4], entitlement_id: grants.observation.entitlements[0].id, status: "issued", asset_version_id: grantVersion, created_at: at(sequence++), released_at: null, last_safe_error: null },
  ];
  const replacement = makeObservation();
  const oldVersion = replacement.observation.manifestItems[0].asset_version_id;
  const replacementCheckout = makeObservation();
  const newVersion = replacementCheckout.observation.manifestItems[0].asset_version_id;
  replacement.observation.catalogAssetVersions[0].current_version_id = newVersion;
  const partial = makeObservation();
  const full = makeObservation();
  const refundRecord = (scenario: "stripe-partial-refund" | "stripe-full-refund", base: ReturnType<typeof makeObservation>, amount: number) => {
    const refundId = `re_${sequence++}`, eventId = `evt_${sequence++}`;
    base.observation.refunds.push({ stripe_refund_id: refundId, amount_cents: amount, status: "succeeded", source_event_id: eventId });
    base.observation.webhookEvents.push({ stripe_event_id: eventId, event_type: "charge.refunded", status: "processed", signature_verified: true, attempt_count: 1, last_attempt_at: at(sequence), processed_at: at(sequence), created_at: at(sequence++) });
    base.observation.entitlements[0].status = scenario === "stripe-full-refund" ? "revoked" : "active";
    return record(scenario, { kind: "refund", refundId, status: "succeeded", amount, paymentIntentId: base.observation.providerPayment.id, webhook: { eventId, type: "charge.refunded", signatureVerified: true, status: "processed", receivedAt: at(sequence), processedAt: at(sequence++), attempts: 1 } }, base);
  };
  const disputeRecord = (outcome: "opened" | "won" | "lost") => {
    const base = makeObservation(), disputeId = `dp_${sequence++}`, chargeId = `ch_${sequence++}`, eventId = `evt_${sequence++}`;
    const appStatus = outcome === "opened" ? "needs_response" : outcome;
    base.observation.disputes.push({ stripe_dispute_id: disputeId, stripe_charge_id: chargeId, stripe_payment_intent_id: base.observation.providerPayment.id, status: appStatus, source_event_id: eventId });
    base.observation.webhookEvents.push({ stripe_event_id: eventId, event_type: `charge.dispute.${outcome}`, status: "processed", signature_verified: true, attempt_count: 1, last_attempt_at: at(sequence), processed_at: at(sequence), created_at: at(sequence++) });
    base.observation.entitlements[0].status = outcome === "opened" ? "suspended" : outcome === "won" ? "active" : "revoked";
    return record(`stripe-dispute-${outcome}`, { kind: "dispute", disputeId, chargeId, paymentIntentId: base.observation.providerPayment.id, outcome, eventIds: [eventId], webhook: { eventId, type: `charge.dispute.${outcome}`, signatureVerified: true, status: "processed", receivedAt: at(sequence), processedAt: at(sequence++), attempts: 1 } }, base);
  };
  const delivery = replacement, deliveryStart = at(sequence++), deliveryFinish = at(sequence++);
  delivery.observation.deliveryJob.attempt_count = 2;
  delivery.observation.deliveryAttempts = [
    { job_id: delivery.observation.deliveryJob.id, attempt_number: 1, status: "failed", started_at: deliveryStart, finished_at: deliveryStart },
    { job_id: delivery.observation.deliveryJob.id, attempt_number: 2, status: "succeeded", started_at: deliveryFinish, finished_at: deliveryFinish },
  ];
  const deliverySentAt = at(sequence++);
  delivery.observation.notifications.push({ id: nextId(), notification_type: "merchant_resend", status: "succeeded", provider: "resend", provider_message_id: "email_retry", attempt_count: 1, sent_at: deliverySentAt });
  const merchant = replacement, merchantSentAt = at(sequence++);
  merchant.observation.notifications.push({ id: nextId(), notification_type: "merchant_resend", status: "succeeded", provider: "resend", provider_message_id: "email_merchant", attempt_count: 1, sent_at: merchantSentAt });
  const observations = [
    record("stripe-digital", { kind: "checkout", sessionId: "cs_test_digital", paymentIntentId: digital.observation.providerPayment.id, orderId: digital.subjectId }, digital),
    record("stripe-mixed", { kind: "checkout", sessionId: "cs_test_mixed", paymentIntentId: mixed.observation.providerPayment.id, orderId: mixed.subjectId }, mixed),
    record("resend-access", { kind: "resend", messageId: "email_access", status: "sent", recipient: "buyer@example.test", orderId: resend.subjectId, accessUrlHash: "a".repeat(64), sentAt: resendSentAt }, resend),
    record("five-grants", { kind: "grants", uniqueGrantIds: grantIds, graceReusedGrantId: grantIds[0], graceCountBefore: 5, graceCountAfter: 5, signingFailureIssuedIdsBefore: grantIds.slice(0, 4), signingFailureIssuedIdsAfter: grantIds.slice(0, 4), signingFailureUsedBefore: 4, signingFailureUsedAfter: 4, releasedFaultGrantId, successfulRetryGrantId: grantIds[4], sixthDeniedStatus: 409, sixthDeniedCode: "download_limit_reached", sixthDeniedMessage: "Download limit reached", sessionHashes: Array.from({ length: 6 }, (_, index) => index.toString(16).padStart(64, "0")), assetVersionId: grantVersion }, grants),
    { ...record("replacement", { kind: "replacement", priorAssetVersionId: oldVersion, replacementAssetVersionId: newVersion, oldBeforeFilename: "art.png", oldAfterFilename: "art.png", newFilename: "art.png", oldBeforeHash: "1".repeat(64), oldAfterHash: "1".repeat(64), newHash: "2".repeat(64), newCheckoutAssetVersionId: newVersion, newCheckoutOrderId: replacementCheckout.subjectId }, replacement), newObservation: replacementCheckout },
    refundRecord("stripe-partial-refund", partial, 100), refundRecord("stripe-full-refund", full, 1000),
    disputeRecord("opened"), disputeRecord("won"), disputeRecord("lost"),
    record("delivery-retry", { kind: "delivery", jobId: delivery.observation.deliveryJob.id, attempts: [{ attempt: 1, status: "failed", startedAt: deliveryStart, finishedAt: deliveryStart }, { attempt: 2, status: "succeeded", startedAt: deliveryFinish, finishedAt: deliveryFinish }], resendMessageId: "email_retry", resendSentAt: deliverySentAt }, delivery),
    record("merchant-resend", { kind: "resend", messageId: "email_merchant", status: "sent", recipient: "buyer@example.test", orderId: merchant.subjectId, accessUrlHash: "b".repeat(64), sentAt: merchantSentAt }, merchant),
  ];
  return { schemaVersion: 3, runId, origin: "https://preview.example.test", releaseVersion: "sha", environment: "preview", startedAt: at(0), completedAt: at(59), observations, signature: "a".repeat(64) };
}
