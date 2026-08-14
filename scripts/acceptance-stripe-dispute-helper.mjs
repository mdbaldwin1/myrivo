// Local Stripe dispute helper for the digital products release acceptance run.
//
// Implements the audited provider-helper contract expected by
// apps/web/e2e/digital-products-fixture.ts (runSupportedStripeDisputeScenario):
// - HTTPS only; bearer token auth; HMAC-SHA256 request and response signing.
// - POST body {"scenario":"opened"|"won"|"lost","paymentIntentId":"pi_..."}.
// - Returns {disputeId, chargeId, paymentIntentId, outcome, eventIds} where the
//   LAST event id is the provider event the application webhook must process.
//
// Stripe test mode cannot open a dispute on an arbitrary charge: the fixture
// orders for dispute scenarios must be paid with a dispute-triggering test
// card (4000000000000259), which auto-creates the dispute. "won"/"lost" are
// driven by submitting Stripe's magic evidence strings.
//
// Env: STRIPE_SECRET_KEY (sk_test_ required), HELPER_TOKEN (>=32 chars),
// HELPER_SIGNING_KEY (>=32 chars), HELPER_CERT, HELPER_KEY (PEM paths),
// HELPER_PORT (default 8443).

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const token = process.env.HELPER_TOKEN ?? "";
const signingKey = process.env.HELPER_SIGNING_KEY ?? "";
const port = Number(process.env.HELPER_PORT ?? "8443");
if (!stripeKey.startsWith("sk_test_")) throw new Error("HELPER: STRIPE_SECRET_KEY must be a test-mode secret");
if (token.length < 32 || signingKey.length < 32) throw new Error("HELPER: token and signing key must be >= 32 chars");

async function stripe(method, path, form) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${stripeKey}`,
      ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {})
    },
    body: form ? new URLSearchParams(form).toString() : undefined
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Stripe ${method} ${path} failed: ${body?.error?.message ?? response.status}`);
  return body;
}

function equal(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

async function findDisputeEvent(type, disputeId, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const events = await stripe("GET", `/v1/events?type=${encodeURIComponent(type)}&limit=50`);
    const match = (events.data ?? []).find((event) => event?.data?.object?.id === disputeId);
    if (match) return match.id;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`No ${type} event observed for ${disputeId}`);
}

async function waitForDisputeStatus(disputeId, statuses, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const dispute = await stripe("GET", `/v1/disputes/${disputeId}`);
    if (statuses.includes(dispute.status)) return dispute;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Dispute ${disputeId} did not reach ${statuses.join("/")}`);
}

async function runScenario(scenario, paymentIntentId) {
  const intent = await stripe("GET", `/v1/payment_intents/${paymentIntentId}?expand[]=latest_charge`);
  if (intent.livemode) throw new Error("Live-mode payment intents are refused");
  const charge = intent.latest_charge;
  if (!charge?.id) throw new Error("Payment intent has no charge");
  const disputeId = typeof charge.dispute === "string" ? charge.dispute : charge.dispute?.id;
  if (!disputeId) throw new Error("Charge has no dispute; pay dispute fixtures with card 4000000000000259");
  const eventIds = [await findDisputeEvent("charge.dispute.created", disputeId)];
  if (scenario !== "opened") {
    const dispute = await stripe("GET", `/v1/disputes/${disputeId}`);
    if (dispute.status === "needs_response" || dispute.status === "warning_needs_response") {
      await stripe("POST", `/v1/disputes/${disputeId}`, {
        "evidence[uncategorized_text]": scenario === "won" ? "winning_evidence" : "losing_evidence",
        submit: "true"
      });
    }
    await waitForDisputeStatus(disputeId, [scenario]);
    eventIds.push(await findDisputeEvent("charge.dispute.closed", disputeId));
  }
  return { disputeId, chargeId: charge.id, paymentIntentId, outcome: scenario, eventIds };
}

const server = https.createServer(
  { cert: readFileSync(process.env.HELPER_CERT ?? ""), key: readFileSync(process.env.HELPER_KEY ?? "") },
  (request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", async () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const respond = (status, body) => {
        const text = JSON.stringify(body);
        response.writeHead(status, {
          "content-type": "application/json",
          "x-myrivo-signature": createHmac("sha256", signingKey).update(text).digest("hex")
        });
        response.end(text);
      };
      try {
        if (request.method !== "POST") return respond(405, { error: "method" });
        if (!equal(request.headers.authorization ?? "", `Bearer ${token}`)) return respond(401, { error: "auth" });
        const expected = createHmac("sha256", signingKey).update(rawBody).digest("hex");
        if (!equal(request.headers["x-myrivo-signature"] ?? "", expected)) return respond(401, { error: "signature" });
        const parsed = JSON.parse(rawBody);
        if (!["opened", "won", "lost"].includes(parsed?.scenario) || !String(parsed?.paymentIntentId ?? "").startsWith("pi_")) {
          return respond(400, { error: "request" });
        }
        console.log(`[helper] ${parsed.scenario} ${parsed.paymentIntentId}`);
        respond(200, await runScenario(parsed.scenario, parsed.paymentIntentId));
      } catch (error) {
        console.error(`[helper] failed: ${error?.message ?? error}`);
        respond(500, { error: "scenario" });
      }
    });
  }
);

server.listen(port, "127.0.0.1", () => console.log(`[helper] listening on https://127.0.0.1:${port}`));
