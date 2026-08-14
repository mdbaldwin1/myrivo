import fs from "node:fs";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { digitalAcceptanceObservationSchema } from "../lib/digital-products/acceptance-evidence";

const relativeRoute = z.string().startsWith("/").refine((value) => !value.startsWith("//") && !value.includes("#token="));
const identity = z.object({ email: z.string().email(), password: z.string().min(12) }).strict();
const schema = z.object({
  baseUrl: z.string().url(), runId: z.string().uuid(), controlSecret: z.string().min(32),
  merchant: identity, customer: identity, storeSlug: z.string().min(1), productSlug: z.string().min(1),
  orderId: z.string().uuid(), productId: z.string().uuid(),
  financialOrders: z.object({ partialRefund: z.string().uuid(), fullRefund: z.string().uuid(), disputeWon: z.string().uuid(), disputeLost: z.string().uuid() }).strict(),
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

export async function acceptanceAction(request: import("@playwright/test").APIRequestContext, fixture: DigitalAcceptanceFixture, action: "observe" | "expire-access" | "inject-delivery-failure" | "inject-refund" | "inject-dispute", transition?: "partial" | "full" | "opened" | "won" | "lost", subjectId = fixture.orderId, scenario?: string) {
  const response = await request.post(fixture.controlUrl, { headers: { authorization: `Bearer ${fixture.controlSecret}` }, data: { version: 1, action, runId: fixture.runId, subjectId, idempotencyKey: crypto.randomUUID(), ...(transition ? { transition } : {}) } });
  if (!response.ok()) throw new Error(`Acceptance action ${action} failed with ${response.status()}`);
  const body = digitalAcceptanceObservationSchema.parse(await response.json());
  if (body.runId !== fixture.runId || body.subjectId !== subjectId) throw new Error(`Acceptance action ${action} returned unbound evidence.`);
  const output = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_OUTPUT;
  if (output) {
    const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : { schemaVersion: 3, runId: fixture.runId, origin: new URL(fixture.baseUrl).origin, releaseVersion: process.env.MYRIVO_DIGITAL_RELEASE_SHA, environment: process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT, startedAt: new Date().toISOString(), observations: [] };
    delete existing.signature; existing.observations.push({ action, transition, scenario, ...body }); existing.completedAt = new Date().toISOString();
    const signingKey = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_HMAC_KEY;
    if (!signingKey || signingKey.length < 32 || signingKey === fixture.controlSecret) throw new Error("A separate evidence HMAC key is required.");
    const unsigned = JSON.stringify(existing); existing.signature = createHmac("sha256", signingKey).update(unsigned).digest("hex");
    fs.writeFileSync(output, JSON.stringify(existing));
  }
  return body;
}

export async function getResendAccessMessage(request: import("@playwright/test").APIRequestContext, recipient: string, orderId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend provider acceptance is not configured.");
  const list = await request.get("https://api.resend.com/emails?limit=100", { headers: { authorization: `Bearer ${key}` } });
  if (!list.ok()) throw new Error("The configured Resend account does not support acceptance message retrieval.");
  const rows = (await list.json() as { data?: Array<{ id: string; to: string[]; subject: string }> }).data ?? [];
  const match = rows.find((row) => row.to.includes(recipient) && row.subject.includes(orderId));
  if (!match) throw new Error("No Resend message matched the completed order and recipient.");
  const detail = await request.get(`https://api.resend.com/emails/${match.id}`, { headers: { authorization: `Bearer ${key}` } });
  if (!detail.ok()) throw new Error("The matching Resend message could not be retrieved.");
  const message = await detail.json() as { id: string; to: string[]; subject: string; html?: string; text?: string };
  const content = `${message.html ?? ""}\n${message.text ?? ""}`;
  const link = content.match(/https?:\/\/[^\s"'<>]+\/downloads#token=[A-Za-z0-9_-]+/)?.[0];
  if (!link || content.includes("storage_path")) throw new Error("Resend message did not contain one safe fragment access link.");
  return { ...message, link };
}

export async function createStripeTestRefund(request: import("@playwright/test").APIRequestContext, paymentIntentId: string, amount?: number) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Stripe refunds require an explicit test-mode secret.");
  const response = await request.post("https://api.stripe.com/v1/refunds", {
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    form: { payment_intent: paymentIntentId, ...(amount ? { amount: String(amount) } : {}), reason: "requested_by_customer" },
  });
  if (!response.ok()) throw new Error(`Stripe test refund failed with ${response.status()}.`);
  const refund = await response.json() as { id?: string; payment_intent?: string; status?: string };
  if (!refund.id?.startsWith("re_") || refund.payment_intent !== paymentIntentId || refund.status !== "succeeded") throw new Error("Stripe returned an uncorrelated refund.");
  return refund;
}

export async function runSupportedStripeDisputeScenario(request: import("@playwright/test").APIRequestContext, scenario: "won" | "lost", paymentIntentId: string) {
  const helperUrl = process.env.MYRIVO_STRIPE_DISPUTE_HELPER_URL;
  const helperToken = process.env.MYRIVO_STRIPE_DISPUTE_HELPER_TOKEN;
  if (!helperUrl || !helperToken) throw new Error(`Stripe dispute scenario ${scenario} is unsupported: configure the audited provider test helper before running the strict gate.`);
  const response = await request.post(helperUrl, { headers: { authorization: `Bearer ${helperToken}` }, data: { scenario, paymentIntentId } });
  if (!response.ok()) throw new Error(`Stripe dispute provider helper rejected ${scenario}.`);
  const result = await response.json() as { disputeId?: string; eventIds?: string[] };
  if (!result.disputeId?.startsWith("dp_") || !result.eventIds?.every((id) => id.startsWith("evt_"))) throw new Error("Stripe dispute helper returned uncorrelated evidence.");
  return result;
}
