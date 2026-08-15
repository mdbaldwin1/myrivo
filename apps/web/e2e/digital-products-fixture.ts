import fs from "node:fs";
import path from "node:path";
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
  // Only scenario-tagged observations are canonical evidence: the signed
  // artifact schema requires every record to be an observe action carrying
  // valid scenario provider evidence, so intermediate observes and fault
  // injections must not be appended.
  if (output && scenario) {
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

function readWebEnv() {
  const raw = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
  return Object.fromEntries(
    raw.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)] as const),
  ) as Record<string, string | undefined>;
}

type DeliveredNotificationType = "purchase" | "merchant_resend" | "customer_recovery";

function deriveNotificationAccessToken(type: DeliveredNotificationType, row: { id: string; delivery_job_id: string | null; token_derivation_nonce: string | null }, secret: string) {
  if (!row.token_derivation_nonce) throw new Error("Delivered notification has no token derivation material.");
  const subject = type === "purchase"
    ? `purchase-delivery-v1:${row.delivery_job_id}:${row.token_derivation_nonce}`
    : type === "merchant_resend"
      ? `merchant-resend-v1:${row.id}:${row.token_derivation_nonce}`
      : `customer-recovery-v1:${row.id}:${row.token_derivation_nonce}`;
  return createHmac("sha256", secret).update(subject).digest("base64url");
}

/**
 * Resolves the exact access email the provider accepted for an order.
 *
 * The persisted notification row is authoritative for the provider message
 * id (set only from a successful Resend send response) and the emailed
 * link's token hash. The link itself is re-derived from the same inputs the
 * mailer used and checked against that persisted hash, so a recipe or data
 * mismatch fails loudly. When the configured Resend key also has read
 * access, the provider copy is fetched and cross-checked; send-only
 * restricted keys (as used in local acceptance) skip that read.
 */
export async function getDeliveredAccessMessage(
  request: import("@playwright/test").APIRequestContext,
  fixture: DigitalAcceptanceFixture,
  orderId: string,
  type: DeliveredNotificationType,
  options: { sentAfterMs?: number; timeoutMs?: number } = {},
) {
  const env = readWebEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  const tokenSecret = process.env.DIGITAL_DELIVERY_TOKEN_SECRET ?? env.DIGITAL_DELIVERY_TOKEN_SECRET;
  if (!supabaseUrl || !serviceRole || !tokenSecret) throw new Error("Digital acceptance message retrieval is not configured.");
  const deadline = Date.now() + (options.timeoutMs ?? 90_000);
  type DeliveredNotificationRow = { id: string; access_token_id: string | null; delivery_job_id: string | null; provider_message_id: string | null; sent_at: string | null };
  type AccessTokenRow = { id: string; token_hash: string; token_derivation_nonce: string | null; delivery_job_id: string | null };
  const restHeaders = { apikey: serviceRole, authorization: `Bearer ${serviceRole}` };
  let row: DeliveredNotificationRow | null = null;
  while (Date.now() < deadline) {
    const response = await request.get(
      `${supabaseUrl}/rest/v1/digital_delivery_notifications?order_id=eq.${orderId}&notification_type=eq.${type}&status=eq.succeeded&select=id,access_token_id,delivery_job_id,provider_message_id,sent_at&order=created_at.desc&limit=1`,
      { headers: restHeaders },
    );
    const rows = response.ok() ? (await response.json() as DeliveredNotificationRow[]) : [];
    const candidate = rows[0] ?? null;
    if (candidate?.provider_message_id && candidate.sent_at && (!options.sentAfterMs || Date.parse(candidate.sent_at) >= options.sentAfterMs)) {
      row = candidate;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  if (!row?.provider_message_id || !row.sent_at || !row.access_token_id) throw new Error(`No delivered ${type} notification matched order ${orderId}.`);
  const tokenResponse = await request.get(
    `${supabaseUrl}/rest/v1/digital_order_access_tokens?id=eq.${row.access_token_id}&order_id=eq.${orderId}&select=id,token_hash,token_derivation_nonce,delivery_job_id&limit=1`,
    { headers: restHeaders },
  );
  const tokenRow = tokenResponse.ok() ? ((await tokenResponse.json() as AccessTokenRow[])[0] ?? null) : null;
  if (!tokenRow) throw new Error(`Delivered ${type} notification has no access token row.`);
  const token = deriveNotificationAccessToken(type, { id: row.id, delivery_job_id: tokenRow.delivery_job_id ?? row.delivery_job_id, token_derivation_nonce: tokenRow.token_derivation_nonce }, tokenSecret);
  if (createHash("sha256").update(token).digest("hex") !== tokenRow.token_hash) {
    throw new Error("Derived access token does not match the persisted token hash.");
  }
  const link = `${new URL(fixture.baseUrl).origin}/downloads#token=${token}`;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const detail = await request.get(`https://api.resend.com/emails/${row.provider_message_id}`, { headers: { authorization: `Bearer ${resendKey}` } });
    if (detail.ok()) {
      const message = await detail.json() as { to?: string[]; subject?: string; html?: string; text?: string };
      const content = `${message.subject ?? ""}\n${message.html ?? ""}\n${message.text ?? ""}`;
      if (!(message.to ?? []).includes(fixture.customer.email) || !content.includes(link) || content.includes("storage_path")) {
        throw new Error("Provider copy of the delivered message does not match the persisted evidence.");
      }
    } else if (detail.status() !== 401) {
      throw new Error(`Resend message retrieval failed with ${detail.status()}.`);
    }
  }
  return {
    id: row.provider_message_id,
    status: "sent" as const,
    sentAt: row.sent_at,
    to: [fixture.customer.email],
    link,
    accessUrlHash: createHash("sha256").update(link).digest("hex"),
  };
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

export async function getStripeRefund(request: import("@playwright/test").APIRequestContext, refundId: string, paymentIntentId: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Stripe refund retrieval requires an explicit test-mode secret.");
  const response = await request.get(`https://api.stripe.com/v1/refunds/${encodeURIComponent(refundId)}`, { headers: { authorization: `Bearer ${key}` } });
  if (!response.ok()) throw new Error(`Stripe refund retrieval failed with ${response.status()}.`);
  const refund = await response.json() as { id?: string; payment_intent?: string; status?: string; amount?: number };
  if (refund.id !== refundId || refund.payment_intent !== paymentIntentId || refund.status !== "succeeded") throw new Error("Stripe returned an uncorrelated refund.");
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
  const response = await request.post(url.toString(), { headers: { authorization: `Bearer ${helperToken}`, "content-type": "application/json", "x-myrivo-signature": requestSignature }, data: requestBody, maxRedirects: 0, timeout: 240_000 });
  if (!response.ok()) throw new Error(`Stripe dispute provider helper rejected ${scenario}.`);
  const responseText = await response.text();
  const responseSignature = response.headers()["x-myrivo-signature"];
  const expected = createHmac("sha256", signingKey).update(responseText).digest("hex");
  if (!responseSignature || responseSignature.length !== expected.length || !timingSafeEqual(Buffer.from(responseSignature), Buffer.from(expected))) throw new Error("Stripe dispute helper response signature is invalid.");
  const result = JSON.parse(responseText) as { disputeId?: string; chargeId?: string; paymentIntentId?: string; eventIds?: string[]; outcome?: string };
  if (!/^d[pu]_/.test(result.disputeId ?? "") || !result.chargeId?.startsWith("ch_") || result.paymentIntentId !== paymentIntentId || result.outcome !== scenario || !result.eventIds?.every((id) => id.startsWith("evt_"))) throw new Error("Stripe dispute helper returned uncorrelated evidence.");
  return result;
}

export async function dismissCookieBannerIfPresent(page: import("@playwright/test").Page) {
  const essential = page.getByRole("button", { name: /essential only/i });
  if (await essential.isVisible().catch(() => false)) await essential.click();
}

export async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await dismissCookieBannerIfPresent(page);
  await page.getByPlaceholder("owner@yourshop.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const legal = page.getByRole("checkbox", { name: /i have read and accept the required legal updates/i });
  if (await legal.isVisible().catch(() => false)) {
    await legal.check();
    await page.getByRole("button", { name: /accept and continue/i }).click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  const { expect } = await import("@playwright/test");
  await expect(page).toHaveURL(/\/(dashboard|onboarding|account)/, { timeout: 20_000 });
}
