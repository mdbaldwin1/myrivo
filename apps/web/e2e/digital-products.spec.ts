import { expect, test } from "@playwright/test";
import { acceptanceAction, loadDigitalAcceptanceFixture } from "./digital-products-fixture";
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
}
test.skip(!fixture, "Digital acceptance requires an explicit non-production fixture.");

test.describe.serial("digital product user journeys", () => {
  test("merchant uploads, previews, and publishes through the catalog UI", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "reset");
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
      await completeStripeCheckout(page);
      await page.getByRole("link", { name: /view downloads|access.*downloads/i }).click();
      await page.getByRole("button", { name: /download/i }).click();
      await expect(page.getByRole("status")).toContainText(/started|preparing/i);
      const observation = await acceptanceAction(request, fixture!, "observe");
      expect(observation.observation).toBeTruthy();
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
    await page.goto(fixture!.routes.merchantOrder);
    await page.getByRole("button", { name: /resend/i }).click();
    await expect(page.getByRole("status")).toContainText(/sent|queued/i);
    await acceptanceAction(request, fixture!, "observe");
  });

  test("provider financial events produce exact customer UI state", async ({ page, request }) => {
    for (const transition of ["partial", "full"] as const) {
      await acceptanceAction(request, fixture!, "inject-refund", transition);
      await page.goto(fixture!.routes.customerOrder);
      await expect(page.getByText(transition === "partial" ? /partially refunded/i : /fully refunded/i)).toBeVisible();
      if (transition === "partial") await expect(page.getByRole("button", { name: /download|access/i })).toBeVisible();
      else await expect(page.getByRole("button", { name: /download|access/i })).toHaveCount(0);
      await acceptanceAction(request, fixture!, "observe");
    }
    for (const transition of ["opened", "won", "lost"] as const) {
      await acceptanceAction(request, fixture!, "inject-dispute", transition);
      await page.goto(fixture!.routes.download);
      await expect(page.locator("main")).toContainText(transition === "opened" ? /temporarily unavailable/i : transition === "won" ? /your files/i : /no longer available|revoked/i);
      if (transition === "won") await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
      else await expect(page.getByRole("button", { name: /download/i })).toHaveCount(0);
      await acceptanceAction(request, fixture!, "observe");
    }
  });

  test("injected delivery failure is visible before UI resend", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "inject-delivery-failure");
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.merchantOrder);
    await expect(page.locator("main")).toContainText(/failed|retry/i);
    await page.getByRole("button", { name: /resend|retry/i }).click();
    await acceptanceAction(request, fixture!, "observe");
  });
});
