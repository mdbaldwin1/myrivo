import fs from "node:fs";
import { z } from "zod";

const relativeRoute = z.string().startsWith("/").refine((value) => !value.startsWith("//") && !value.includes("#token="));
const identity = z.object({ email: z.string().email(), password: z.string().min(12) }).strict();
const schema = z.object({
  baseUrl: z.string().url(), runId: z.string().uuid(), controlSecret: z.string().min(32),
  merchant: identity, customer: identity, storeSlug: z.string().min(1), productSlug: z.string().min(1),
  controlUrl: relativeRoute,
  routes: z.object({ catalogFiles: relativeRoute, product: relativeRoute, cart: relativeRoute, checkoutReturn: relativeRoute, download: relativeRoute, recovery: relativeRoute, customerOrder: relativeRoute, merchantOrder: relativeRoute }).strict(),
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

export async function acceptanceAction(request: import("@playwright/test").APIRequestContext, fixture: DigitalAcceptanceFixture, action: string, expectedState: Record<string, unknown> = {}) {
  const response = await request.post(fixture.controlUrl, { headers: { authorization: `Bearer ${fixture.controlSecret}`, "x-myrivo-acceptance-run": fixture.runId }, data: { action } });
  if (!response.ok()) throw new Error(`Acceptance action ${action} failed with ${response.status()}`);
  const body = await response.json() as { runId?: string; providerEventId?: string; state?: Record<string, unknown> };
  if (body.runId !== fixture.runId || !body.providerEventId || !body.state) throw new Error(`Acceptance action ${action} returned unbound evidence.`);
  for (const [key, value] of Object.entries(expectedState)) {
    if (body.state[key] !== value) throw new Error(`Acceptance action ${action} expected ${key}=${String(value)}.`);
  }
  return body;
}
