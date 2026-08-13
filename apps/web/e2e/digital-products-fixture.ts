import fs from "node:fs";
import { createHmac } from "node:crypto";
import { z } from "zod";

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
  const body = await response.json() as { version?: number; runId?: string; observedAt?: string; observation?: { order?: Record<string, unknown>; [key: string]: unknown } };
  if (body.version !== 1 || body.runId !== fixture.runId || !body.observedAt || !body.observation) throw new Error(`Acceptance action ${action} returned unbound evidence.`);
  const output = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_OUTPUT;
  if (output) {
    const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : { schemaVersion: 3, runId: fixture.runId, origin: new URL(fixture.baseUrl).origin, releaseVersion: process.env.MYRIVO_DIGITAL_RELEASE_SHA, environment: process.env.MYRIVO_DIGITAL_ACCEPTANCE_ENVIRONMENT, startedAt: new Date().toISOString(), observations: [] };
    delete existing.signature; existing.observations.push({ action, transition, scenario, subjectId, ...body }); existing.completedAt = new Date().toISOString();
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
