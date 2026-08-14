import fs from "node:fs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { assertNoAcceptanceSecrets, digitalAcceptanceObservationSchema, digitalAcceptanceScenarioEvidenceSchema, hashAcceptanceSession } from "../lib/digital-products/acceptance-evidence";

const relativeRoute = z.string().startsWith("/").refine((value) => !value.startsWith("//") && !value.includes("#token="));
const identity = z.object({ email: z.string().email(), password: z.string().min(12) }).strict();
const schema = z.object({
  baseUrl: z.string().url(), runId: z.string().uuid(), controlSecret: z.string().min(32),
  merchant: identity, customer: identity, storeSlug: z.string().min(1), productSlug: z.string().min(1),
  orderId: z.string().uuid(), productId: z.string().uuid(),
  financialOrders: z.object({ partialRefund: z.string().uuid(), fullRefund: z.string().uuid(), disputeOpened: z.string().uuid(), disputeWon: z.string().uuid(), disputeLost: z.string().uuid() }).strict(),
  controlUrl: relativeRoute,
  routes: z.object({ catalogFiles: relativeRoute, product: relativeRoute, physicalProduct: relativeRoute, cart: relativeRoute, checkoutReturn: relativeRoute, download: relativeRoute, recovery: relativeRoute, customerOrder: relativeRoute, merchantOrder: relativeRoute }).strict(),
}).strict();

export type DigitalAcceptanceFixture = z.infer<typeof schema>;

export function loadDigitalAcceptanceFixture(): DigitalAcceptanceFixture | null {
  const fixturePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE;
  if (!fixturePath || !fs.existsSync(fixturePath)) {
    if (process.env.MYRIVO_DIGITAL_RELEASE_GATE === "true") throw new Error("Digital release gate requires an acceptance fixture.");
    return null;
  }
  const fixture = schema.parse(JSON.parse(fs.readFileSync(fixturePath, "utf8")));
  const base = new URL(fixture.baseUrl);
  if (base.origin !== process.env.E2E_BASE_URL) throw new Error("Acceptance fixture origin must match E2E_BASE_URL.");
  return fixture;
}

export async function acceptanceAction(request: import("@playwright/test").APIRequestContext, fixture: DigitalAcceptanceFixture, action: "observe" | "expire-access" | "inject-delivery-failure" | "inject-signing-failure" | "inject-refund" | "inject-dispute", transition?: "partial" | "full" | "opened" | "won" | "lost", subjectId = fixture.orderId, scenario?: string, providerEvidence?: unknown, newObservation?: unknown) {
  const response = await request.post(fixture.controlUrl, { headers: { authorization: `Bearer ${fixture.controlSecret}` }, data: { version: 1, action, runId: fixture.runId, subjectId, idempotencyKey: crypto.randomUUID(), ...(transition ? { transition } : {}) } });
  if (!response.ok()) throw new Error(`Acceptance action ${action} failed with ${response.status()}`);
  const body = digitalAcceptanceObservationSchema.parse(await response.json());
  if (body.runId !== fixture.runId || body.subjectId !== subjectId) throw new Error(`Acceptance action ${action} returned unbound evidence.`);
  if (scenario) digitalAcceptanceScenarioEvidenceSchema.parse({ scenario, providerEvidence });
  const output = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_OUTPUT;
  if (output) {
    const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : { schemaVersion: 3, runId: fixture.runId, origin: new URL(fixture.baseUrl).origin, releaseVersion: process.env.MYRIVO_DIGITAL_RELEASE_SHA, environment: process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT, startedAt: new Date().toISOString(), observations: [] };
    delete existing.signature; existing.observations.push({ action, transition, scenario, providerEvidence, ...(newObservation ? { newObservation } : {}), ...body }); existing.completedAt = new Date().toISOString();
    const signingKey = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_HMAC_KEY;
    if (!signingKey || signingKey.length < 32 || signingKey === fixture.controlSecret) throw new Error("A separate evidence HMAC key is required.");
    assertNoAcceptanceSecrets(existing);
    const unsigned = JSON.stringify(existing); existing.signature = createHmac("sha256", signingKey).update(unsigned).digest("hex");
    fs.writeFileSync(output, JSON.stringify(existing));
  }
  return body;
}

export function acceptanceSessionHash(value: string) {
  const key = process.env.MYRIVO_DIGITAL_ACCEPTANCE_REDACTION_KEY;
  if (!key) throw new Error("A separate acceptance evidence redaction key is required.");
  return hashAcceptanceSession(value, key);
}

export async function getResendAccessMessage(request: import("@playwright/test").APIRequestContext, recipient: string, orderId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend provider acceptance is not configured.");
  const list = await request.get("https://api.resend.com/emails?limit=100", { headers: { authorization: `Bearer ${key}` } });
  if (!list.ok()) throw new Error("The configured Resend account does not support acceptance message retrieval.");
  const rows = (await list.json() as { data?: Array<{ id: string; to: string[]; subject: string }> }).data ?? [];
  const candidates = rows.filter((row) => row.to.includes(recipient)).slice(0, 25);
  for (const candidate of candidates) {
    const detail = await request.get(`https://api.resend.com/emails/${candidate.id}`, { headers: { authorization: `Bearer ${key}` } });
    if (!detail.ok()) continue;
    const message = await detail.json() as { id: string; to: string[]; subject: string; html?: string; text?: string };
    const content = `${message.html ?? ""}\n${message.text ?? ""}`;
    if (!candidate.subject.includes(orderId) && !content.includes(orderId)) continue;
    const link = content.match(/https?:\/\/[^\s"'<>]+\/downloads#token=[A-Za-z0-9_-]+/)?.[0];
    if (!link || content.includes("storage_path")) throw new Error("Resend message did not contain one safe fragment access link.");
    return { ...message, status: "sent" as const, sentAt: (message as { created_at?: string }).created_at, link, accessUrlHash: createHash("sha256").update(link).digest("hex") };
  }
  throw new Error("No Resend message matched the completed order and recipient.");
}

export async function createStripeTestRefund(request: import("@playwright/test").APIRequestContext, paymentIntentId: string, amount?: number) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Stripe refunds require an explicit test-mode secret.");
  const response = await request.post("https://api.stripe.com/v1/refunds", {
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    form: { payment_intent: paymentIntentId, ...(amount ? { amount: String(amount) } : {}), reason: "requested_by_customer" },
  });
  if (!response.ok()) throw new Error(`Stripe test refund failed with ${response.status()}.`);
  const refund = await response.json() as { id?: string; payment_intent?: string; status?: string; amount?: number };
  if (!refund.id?.startsWith("re_") || refund.payment_intent !== paymentIntentId || refund.status !== "succeeded") throw new Error("Stripe returned an uncorrelated refund.");
  return refund;
}

export async function waitForFinancialObservation(request: import("@playwright/test").APIRequestContext, fixture: DigitalAcceptanceFixture, subjectId: string, eventId?: string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const observation = await acceptanceAction(request, fixture, "observe", undefined, subjectId);
    if (observation.observation.webhookEvents.some((event) => event.status === "processed" && (!eventId || event.stripe_event_id === eventId))) return observation;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Timed out waiting for the correlated Stripe webhook and application transition.");
}

export async function getStripeCheckoutEvidence(request: import("@playwright/test").APIRequestContext, paymentIntentId: string, orderId: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Stripe checkout evidence requires an explicit test-mode secret.");
  const intentResponse = await request.get(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, { headers: { authorization: `Bearer ${key}` }, timeout: 15_000 });
  if (!intentResponse.ok()) throw new Error("Stripe payment intent retrieval failed.");
  const intent = await intentResponse.json() as { id?: string; livemode?: boolean; metadata?: { order_id?: string } };
  if (intent.id !== paymentIntentId || intent.livemode !== false || intent.metadata?.order_id !== orderId) {
    throw new Error("Stripe PaymentIntent does not carry the finalized order identity.");
  }
  const response = await request.get(`https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntentId)}&limit=2`, { headers: { authorization: `Bearer ${key}` }, timeout: 15_000 });
  if (!response.ok()) throw new Error("Stripe checkout session retrieval failed.");
  const sessions = (await response.json() as { data?: Array<{ id: string; payment_intent: string }> }).data ?? [];
  const session = sessions.find((item) => item.payment_intent === paymentIntentId);
  if (!session?.id.startsWith("cs_test_")) throw new Error("No Stripe Checkout Session correlated the payment and order.");
  return { kind: "checkout" as const, sessionId: session.id, paymentIntentId, orderId };
}

export async function runSupportedStripeDisputeScenario(request: import("@playwright/test").APIRequestContext, scenario: "opened" | "won" | "lost", paymentIntentId: string) {
  const helperUrl = process.env.MYRIVO_STRIPE_DISPUTE_HELPER_URL;
  const helperToken = process.env.MYRIVO_STRIPE_DISPUTE_HELPER_TOKEN;
  const signingKey = process.env.MYRIVO_STRIPE_DISPUTE_HELPER_SIGNING_KEY;
  const approvedOrigin = process.env.MYRIVO_STRIPE_DISPUTE_HELPER_ORIGIN;
  if (!helperUrl || !helperToken || !signingKey || !approvedOrigin) throw new Error(`Stripe dispute scenario ${scenario} is unsupported: configure the audited provider test helper before running the strict gate.`);
  const url = new URL(helperUrl);
  if (url.protocol !== "https:" || url.origin !== approvedOrigin || new URL(approvedOrigin).origin !== approvedOrigin) throw new Error("Stripe dispute helper must use the exact allowlisted HTTPS origin.");
  const requestBody = JSON.stringify({ scenario, paymentIntentId });
  const requestSignature = createHmac("sha256", signingKey).update(requestBody).digest("hex");
  const response = await request.post(url.toString(), { headers: { authorization: `Bearer ${helperToken}`, "content-type": "application/json", "x-myrivo-signature": requestSignature }, data: requestBody, maxRedirects: 0, timeout: 15_000 });
  if (!response.ok()) throw new Error(`Stripe dispute provider helper rejected ${scenario}.`);
  const responseText = await response.text();
  const responseSignature = response.headers()["x-myrivo-signature"];
  const expected = createHmac("sha256", signingKey).update(responseText).digest("hex");
  if (!responseSignature || responseSignature.length !== expected.length || !timingSafeEqual(Buffer.from(responseSignature), Buffer.from(expected))) throw new Error("Stripe dispute helper response signature is invalid.");
  const result = JSON.parse(responseText) as { disputeId?: string; chargeId?: string; paymentIntentId?: string; eventIds?: string[]; outcome?: string };
  if (!result.disputeId?.startsWith("dp_") || !result.chargeId?.startsWith("ch_") || result.paymentIntentId !== paymentIntentId || result.outcome !== scenario || !result.eventIds?.every((id) => id.startsWith("evt_"))) throw new Error("Stripe dispute helper returned uncorrelated evidence.");
  return result;
}
