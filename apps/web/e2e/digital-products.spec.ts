import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { acceptanceAction, acceptanceSessionHash, createStripeTestRefund, getResendAccessMessage, getStripeCheckoutEvidence, loadDigitalAcceptanceFixture, runSupportedStripeDisputeScenario, waitForFinancialObservation } from "./digital-products-fixture";
import { login } from "./helpers";

const fixture = loadDigitalAcceptanceFixture();
const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function waitForFinalDownload(page: import("@playwright/test").Page) {
  return page.waitForResponse((response) => {
    let request: import("@playwright/test").Request | null = response.request();
    let originatedAtDownloadPost = false;
    while (request) {
      if (request.url().includes("/api/digital-downloads/file/") && request.method() === "POST") originatedAtDownloadPost = true;
      request = request.redirectedFrom();
    }
    return originatedAtDownloadPost && response.status() === 200 && !response.url().includes("/api/digital-downloads/file/");
  });
}

async function completeStripeCheckout(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
  await page.getByLabel(/email/i).fill(fixture!.customer.email).catch(() => undefined);
  await page.getByLabel(/card number/i).fill("4242424242424242");
  await page.getByLabel(/expiration/i).fill("1234");
  await page.getByLabel(/security code|cvc/i).fill("123");
  await page.getByRole("button", { name: /pay|submit/i }).click();
  await expect(page).toHaveURL(new RegExp(new URL(fixture!.baseUrl).host), { timeout: 60_000 });
  await expect(page.getByRole("link", { name: /view downloads|access.*downloads/i })).toBeVisible({ timeout: 60_000 });
  const text = await page.locator("main").innerText();
  const orderId = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
  if (!orderId) throw new Error("Checkout return did not expose the newly completed order identity.");
  return orderId;
}
test.skip(!fixture, "Digital acceptance requires an explicit non-production fixture.");

test.describe.serial("digital product user journeys", () => {
  test("merchant uploads, previews, and publishes through the catalog UI", async ({ page, request }) => {
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.catalogFiles);
    await page.getByLabel(/file/i).setInputFiles({ name: "acceptance-art.png", mimeType: "image/png", buffer: validPng });
    await expect(page.getByRole("status")).toContainText(/upload|processing|ready/i);
    await page.getByRole("button", { name: /publish|activate/i }).click();
    await expect(page.getByText("Ready to sell", { exact: true })).toBeVisible();
    const observed = await acceptanceAction(request, fixture!, "observe");
    expect(observed.observation).toBeTruthy();
  });

  test("buyer completes digital-only and mixed Stripe checkouts before access", async ({ page, request }) => {
    for (const composition of ["digital", "mixed"] as const) {
      await page.goto(fixture!.routes.product);
      await page.getByRole("button", { name: /add to cart/i }).click();
      if (composition === "mixed") {
        await page.goto(fixture!.routes.physicalProduct);
        await page.getByRole("button", { name: /add to cart/i }).click();
      }
      await page.goto(fixture!.routes.cart);
      await page.getByRole("button", { name: /checkout/i }).click();
      const orderId = await completeStripeCheckout(page);
      const message = await getResendAccessMessage(request, fixture!.customer.email, orderId);
      expect(message.to).toContain(fixture!.customer.email);
      await acceptanceAction(request, fixture!, "observe", undefined, orderId, "resend-access", { kind: "resend", messageId: message.id, status: message.status, recipient: fixture!.customer.email, orderId, accessUrlHash: message.accessUrlHash, sentAt: message.sentAt });
      await page.getByRole("link", { name: /view downloads|access.*downloads/i }).click();
      const downloadButton = page.getByRole("button", { name: /download/i });
      if (composition === "digital") {
        const sessionHashes: string[] = [];
        let graceReusedGrantId = "";
        const beforeSigningFailure = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const signingFailureGrantIdsBefore = beforeSigningFailure.observation.grants.map((grant) => grant.id);
        await acceptanceAction(request, fixture!, "inject-signing-failure", undefined, orderId);
        const failureContext = await page.context().browser()!.newContext();
        const failurePage = await failureContext.newPage();
        await failurePage.goto(message.link);
        await failurePage.getByRole("button", { name: /download/i }).click();
        await expect(failurePage.getByRole("status")).toContainText(/unable|retry/i);
        await failureContext.close();
        const afterInjectedFailure = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const signingFailureGrantIdsAfter = afterInjectedFailure.observation.grants.map((grant) => grant.id);
        if (JSON.stringify(signingFailureGrantIdsAfter) !== JSON.stringify(signingFailureGrantIdsBefore)) throw new Error("Signing failure changed download grants.");
        for (let index = 0; index < 5; index += 1) {
          const context = await page.context().browser()!.newContext();
          const sessionPage = await context.newPage();
          await sessionPage.goto(message.link);
          await sessionPage.getByRole("button", { name: /download/i }).click();
          const cookies = await context.cookies();
          sessionHashes.push(acceptanceSessionHash(cookies.map((cookie) => `${cookie.name}:${cookie.value}`).join("|")));
          if (index === 0) {
            const beforeGrace = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
            const firstGrantId = beforeGrace.observation.grants.at(-1)?.id;
            await sessionPage.getByRole("button", { name: /download/i }).click();
            const grace = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
            graceReusedGrantId = grace.observation.grants.at(-1)?.id ?? "";
            if (!firstGrantId || graceReusedGrantId !== firstGrantId || grace.observation.grants.length !== beforeGrace.observation.grants.length) throw new Error("Same-session grace did not reuse the same grant.");
          }
          await context.close();
        }
        const five = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const corrupt = await page.context().browser()!.newContext();
        await (await corrupt.newPage()).goto(message.link.replace(/.$/, "x"));
        await corrupt.close();
        await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const sixth = await page.context().browser()!.newContext();
        const sixthPage = await sixth.newPage();
        await sixthPage.goto(message.link);
        const sixthResponse = sixthPage.waitForResponse((response) => response.url().includes("/api/digital-downloads/file/"));
        await sixthPage.getByRole("button", { name: /download/i }).click();
        const denied = await sixthResponse;
        const sixthDeniedMessage = "Download limit reached";
        await expect(sixthPage.getByText(sixthDeniedMessage, { exact: true })).toBeVisible();
        sessionHashes.push(acceptanceSessionHash((await sixth.cookies()).map((cookie) => `${cookie.name}:${cookie.value}`).join("|")));
        await sixth.close();
        await acceptanceAction(request, fixture!, "observe", undefined, orderId, "five-grants", { kind: "grants", uniqueGrantIds: five.observation.grants.map((grant) => grant.id), graceReusedGrantId, graceCountBefore: five.observation.grants.length, graceCountAfter: five.observation.grants.length, signingFailureGrantIdsBefore, signingFailureGrantIdsAfter, sixthDeniedStatus: denied.status(), sixthDeniedMessage, sessionHashes, assetVersionId: five.observation.grants[0]?.asset_version_id });
      } else {
        await downloadButton.click();
        await expect(page.getByRole("status")).toContainText(/started|preparing/i);
      }
      const beforeCheckoutEvidence = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
      const checkoutEvidence = await getStripeCheckoutEvidence(request, beforeCheckoutEvidence.observation.providerPayment.id, orderId);
      const observation = await acceptanceAction(request, fixture!, "observe", undefined, orderId, composition === "digital" ? "stripe-digital" : "stripe-mixed", checkoutEvidence);
      expect(observation.observation?.order).toEqual(expect.objectContaining({ id: orderId, checkout_composition: composition === "digital" ? "digital_only" : "mixed" }));
    }
  });

  test("buyer requests recovery and merchant replaces/resends through UI", async ({ page, request }) => {
    const before = await acceptanceAction(request, fixture!, "observe");
    const priorVersion = before.observation.manifestItems[0];
    if (!priorVersion) throw new Error("Prior buyer manifest has no immutable asset version.");
    const priorMessage = await getResendAccessMessage(request, fixture!.customer.email, fixture!.orderId);
    const priorContext = await page.context().browser()!.newContext();
    const priorPage = await priorContext.newPage();
    await priorPage.goto(priorMessage.link);
    const priorResponse = waitForFinalDownload(priorPage);
    await priorPage.getByRole("button", { name: /download/i }).click();
    const priorStorageResponse = await priorResponse;
    expect(priorStorageResponse.headers()["content-disposition"]).toContain(priorVersion.customer_filename);
    const priorContentSha256 = createHash("sha256").update(await priorStorageResponse.body()).digest("hex");
    await priorContext.close();
    await page.goto(fixture!.routes.recovery);
    await page.getByLabel(/order id/i).fill(fixture!.orderId);
    await page.getByLabel(/order email/i).fill(fixture!.customer.email);
    await page.getByRole("button", { name: /fresh link/i }).click();
    await expect(page.getByRole("status")).toContainText(/check your email/i);
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.catalogFiles);
    await page.getByRole("button", { name: /replace/i }).click();
    await page.getByLabel(/file/i).setInputFiles({ name: "acceptance-art-v2.png", mimeType: "image/png", buffer: validPng });
    const after = await acceptanceAction(request, fixture!, "observe");
    const replacementVersion = after.observation.catalogAssetVersions.find((asset) => asset.current_version_id !== priorVersion.asset_version_id)?.current_version_id;
    if (!replacementVersion) throw new Error("Replacement did not produce a new immutable asset version.");
    const buyer = await page.context().browser()!.newContext();
    const buyerPage = await buyer.newPage();
    await buyerPage.goto(fixture!.routes.product);
    await buyerPage.getByRole("button", { name: /add to cart/i }).click();
    await buyerPage.goto(fixture!.routes.cart);
    await buyerPage.getByRole("button", { name: /checkout/i }).click();
    const replacementOrderId = await completeStripeCheckout(buyerPage);
    const replacementOrder = await acceptanceAction(request, fixture!, "observe", undefined, replacementOrderId);
    const oldAfterContext = await page.context().browser()!.newContext();
    const oldAfterPage = await oldAfterContext.newPage();
    await oldAfterPage.goto(priorMessage.link);
    const oldAfterResponse = waitForFinalDownload(oldAfterPage);
    await oldAfterPage.getByRole("button", { name: /download/i }).click();
    const oldAfterStorageResponse = await oldAfterResponse;
    expect(oldAfterStorageResponse.headers()["content-disposition"]).toContain(priorVersion.customer_filename);
    const oldAfterHash = createHash("sha256").update(await oldAfterStorageResponse.body()).digest("hex");
    await oldAfterContext.close();
    if (oldAfterHash !== priorContentSha256) throw new Error("Replacement changed the prior buyer's immutable file bytes.");
    const newMessage = await getResendAccessMessage(request, fixture!.customer.email, replacementOrderId);
    const newContext = await page.context().browser()!.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto(newMessage.link);
    const newResponse = waitForFinalDownload(newPage);
    await newPage.getByRole("button", { name: /download/i }).click();
    const replacementStorageResponse = await newResponse;
    const replacementFilename = replacementOrder.observation.manifestItems.find((item) => item.asset_version_id === replacementVersion)?.customer_filename;
    if (!replacementFilename) throw new Error("Replacement manifest has no customer filename.");
    expect(replacementStorageResponse.headers()["content-disposition"]).toContain(replacementFilename);
    const replacementContentSha256 = createHash("sha256").update(await replacementStorageResponse.body()).digest("hex");
    await newContext.close();
    if (replacementContentSha256 === priorContentSha256) throw new Error("Replacement checkout served the prior file bytes.");
    await buyer.close();
    if (!replacementOrder.observation.manifestItems.some((item) => item.asset_version_id === replacementVersion)) throw new Error("New checkout did not snapshot the replacement version.");
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "replacement", { kind: "replacement", priorAssetVersionId: priorVersion.asset_version_id, replacementAssetVersionId: replacementVersion, priorFilename: priorVersion.customer_filename, priorContentSha256, newCheckoutAssetVersionId: replacementVersion });
    await page.goto(fixture!.routes.merchantOrder);
    await page.getByRole("button", { name: /resend/i }).click();
    await expect(page.getByRole("status")).toContainText(/sent|queued/i);
    const resendMessage = await getResendAccessMessage(request, fixture!.customer.email, fixture!.orderId);
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "merchant-resend", { kind: "resend", messageId: resendMessage.id, status: resendMessage.status, recipient: fixture!.customer.email, orderId: fixture!.orderId, accessUrlHash: resendMessage.accessUrlHash, sentAt: resendMessage.sentAt });
  });

  test("provider financial events produce exact customer UI state", async ({ page, request }) => {
    for (const transition of ["partial", "full"] as const) {
      const subject = transition === "partial" ? fixture!.financialOrders.partialRefund : fixture!.financialOrders.fullRefund;
      const before = await acceptanceAction(request, fixture!, "observe", undefined, subject);
      const paymentIntentId = before.observation?.providerPayment?.id;
      if (typeof paymentIntentId !== "string") throw new Error("Refund fixture has no correlated Stripe PaymentIntent.");
      const refund = await createStripeTestRefund(request, paymentIntentId, transition === "partial" ? 1 : undefined);
      const processed = await waitForFinancialObservation(request, fixture!, subject);
      const refundRow = processed.observation.refunds.find((row) => row.stripe_refund_id === refund.id);
      const webhook = processed.observation.webhookEvents.find((row) => row.stripe_event_id === refundRow?.source_event_id);
      if (!refundRow || !webhook?.processed_at) throw new Error("Refund webhook did not produce correlated application state.");
      await page.goto(fixture!.routes.customerOrder);
      await expect(page.getByText(transition === "partial" ? /partially refunded/i : /fully refunded/i)).toBeVisible();
      if (transition === "partial") await expect(page.getByRole("button", { name: /download|access/i })).toBeVisible();
      else await expect(page.getByRole("button", { name: /download|access/i })).toHaveCount(0);
      await acceptanceAction(request, fixture!, "observe", undefined, subject, transition === "partial" ? "stripe-partial-refund" : "stripe-full-refund", { kind: "refund", refundId: refund.id, status: refund.status, amount: refund.amount, paymentIntentId, webhook: { eventId: webhook.stripe_event_id, type: webhook.event_type, signatureVerified: webhook.signature_verified, status: "processed", receivedAt: webhook.created_at, processedAt: webhook.processed_at, attempts: webhook.attempt_count } });
    }
    for (const transition of ["opened", "won", "lost"] as const) {
      const subject = transition === "opened" ? fixture!.financialOrders.disputeOpened : transition === "lost" ? fixture!.financialOrders.disputeLost : fixture!.financialOrders.disputeWon;
      const before = await acceptanceAction(request, fixture!, "observe", undefined, subject);
      const paymentIntentId = before.observation?.providerPayment?.id;
      if (typeof paymentIntentId !== "string") throw new Error("Dispute fixture has no correlated Stripe PaymentIntent.");
      const dispute = await runSupportedStripeDisputeScenario(request, transition, paymentIntentId);
      const processed = await waitForFinancialObservation(request, fixture!, subject, dispute.eventIds![dispute.eventIds!.length - 1]);
      const webhook = processed.observation.webhookEvents.find((row) => row.stripe_event_id === dispute.eventIds![dispute.eventIds!.length - 1]);
      if (!webhook?.processed_at) throw new Error("Dispute webhook did not produce correlated application state.");
      await page.goto(fixture!.routes.download);
      await expect(page.locator("main")).toContainText(transition === "opened" ? /temporarily unavailable/i : transition === "won" ? /your files/i : /no longer available|revoked/i, { timeout: 60_000 });
      if (transition === "won") await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
      else await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
      await acceptanceAction(request, fixture!, "observe", undefined, subject, transition === "opened" ? "stripe-dispute-opened" : transition === "won" ? "stripe-dispute-won" : "stripe-dispute-lost", { kind: "dispute", disputeId: dispute.disputeId, chargeId: dispute.chargeId, paymentIntentId, outcome: transition, eventIds: dispute.eventIds, webhook: { eventId: webhook.stripe_event_id, type: webhook.event_type, signatureVerified: webhook.signature_verified, status: "processed", receivedAt: webhook.created_at, processedAt: webhook.processed_at, attempts: webhook.attempt_count } });
    }
  });

  test("injected delivery failure is visible before UI resend", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "inject-delivery-failure");
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.merchantOrder);
    await expect(page.locator("main")).toContainText(/failed|retry/i);
    await page.getByRole("button", { name: /resend|retry/i }).click();
    const observed = await acceptanceAction(request, fixture!, "observe");
    const resend = await getResendAccessMessage(request, fixture!.customer.email, fixture!.orderId);
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "delivery-retry", { kind: "delivery", jobId: observed.observation.deliveryJob.id, attempts: observed.observation.deliveryAttempts.map((attempt) => ({ attempt: attempt.attempt_number, status: attempt.status, timestamp: attempt.finished_at ?? attempt.started_at })), resendMessageId: resend.id });
  });
});
