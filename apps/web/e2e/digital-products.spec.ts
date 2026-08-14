import { expect, test } from "@playwright/test";
import { acceptanceAction, createStripeTestRefund, getResendAccessMessage, loadDigitalAcceptanceFixture, runSupportedStripeDisputeScenario } from "./digital-products-fixture";
import { login } from "./helpers";

const fixture = loadDigitalAcceptanceFixture();
const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

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
      await acceptanceAction(request, fixture!, "observe", undefined, orderId, "resend-access");
      const clean = await page.context().browser()!.newContext();
      const downloadPage = await clean.newPage();
      await downloadPage.goto(message.link);
      await expect(downloadPage).toHaveURL(/\/downloads$/);
      await downloadPage.getByRole("button", { name: /download/i }).click();
      await clean.close();
      await page.getByRole("link", { name: /view downloads|access.*downloads/i }).click();
      const downloadButton = page.getByRole("button", { name: /download/i });
      await downloadButton.click();
      await expect(page.getByRole("status")).toContainText(/started|preparing/i);
      if (composition === "digital") {
        for (let additionalGrant = 0; additionalGrant < 3; additionalGrant += 1) await downloadButton.click();
        await acceptanceAction(request, fixture!, "observe", undefined, orderId, "five-grants");
        await downloadButton.click();
        await expect(page.getByRole("status")).toContainText(/limit|contact|unavailable/i);
      }
      const observation = await acceptanceAction(request, fixture!, "observe", undefined, orderId, composition === "digital" ? "stripe-digital" : "stripe-mixed");
      expect(observation.observation?.order).toEqual(expect.objectContaining({ id: orderId, checkout_composition: composition === "digital" ? "digital_only" : "mixed" }));
    }
  });

  test("buyer requests recovery and merchant replaces/resends through UI", async ({ page, request }) => {
    await page.goto(fixture!.routes.recovery);
    await page.getByLabel(/order id/i).fill(fixture!.orderId);
    await page.getByLabel(/order email/i).fill(fixture!.customer.email);
    await page.getByRole("button", { name: /fresh link/i }).click();
    await expect(page.getByRole("status")).toContainText(/check your email/i);
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.catalogFiles);
    await page.getByRole("button", { name: /replace/i }).click();
    await page.getByLabel(/file/i).setInputFiles({ name: "acceptance-art-v2.png", mimeType: "image/png", buffer: validPng });
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "replacement");
    await page.goto(fixture!.routes.merchantOrder);
    await page.getByRole("button", { name: /resend/i }).click();
    await expect(page.getByRole("status")).toContainText(/sent|queued/i);
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "merchant-resend");
  });

  test("provider financial events produce exact customer UI state", async ({ page, request }) => {
    for (const transition of ["partial", "full"] as const) {
      const subject = transition === "partial" ? fixture!.financialOrders.partialRefund : fixture!.financialOrders.fullRefund;
      const before = await acceptanceAction(request, fixture!, "observe", undefined, subject);
      const paymentIntentId = before.observation?.providerPayment?.id;
      if (typeof paymentIntentId !== "string") throw new Error("Refund fixture has no correlated Stripe PaymentIntent.");
      await createStripeTestRefund(request, paymentIntentId, transition === "partial" ? 1 : undefined);
      await page.goto(fixture!.routes.customerOrder);
      await expect(page.getByText(transition === "partial" ? /partially refunded/i : /fully refunded/i)).toBeVisible();
      if (transition === "partial") await expect(page.getByRole("button", { name: /download|access/i })).toBeVisible();
      else await expect(page.getByRole("button", { name: /download|access/i })).toHaveCount(0);
      await acceptanceAction(request, fixture!, "observe", undefined, subject, transition === "partial" ? "stripe-partial-refund" : "stripe-full-refund");
    }
    for (const transition of ["opened", "won", "lost"] as const) {
      if (transition === "opened") continue;
      const subject = transition === "lost" ? fixture!.financialOrders.disputeLost : fixture!.financialOrders.disputeWon;
      const before = await acceptanceAction(request, fixture!, "observe", undefined, subject);
      const paymentIntentId = before.observation?.providerPayment?.id;
      if (typeof paymentIntentId !== "string") throw new Error("Dispute fixture has no correlated Stripe PaymentIntent.");
      await runSupportedStripeDisputeScenario(request, transition, paymentIntentId);
      await page.goto(fixture!.routes.download);
      await expect(page.locator("main")).toContainText(transition === "won" ? /your files/i : /no longer available|revoked/i, { timeout: 60_000 });
      if (transition === "won") await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
      else await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
      await acceptanceAction(request, fixture!, "observe", undefined, subject, transition === "won" ? "stripe-dispute-won" : "stripe-dispute-lost");
    }
  });

  test("injected delivery failure is visible before UI resend", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "inject-delivery-failure");
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.merchantOrder);
    await expect(page.locator("main")).toContainText(/failed|retry/i);
    await page.getByRole("button", { name: /resend|retry/i }).click();
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "delivery-retry");
  });
});
