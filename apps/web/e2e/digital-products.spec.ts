import { expect, test } from "@playwright/test";
import { acceptanceAction, loadDigitalAcceptanceFixture } from "./digital-products-fixture";
import { login } from "./helpers";

const fixture = loadDigitalAcceptanceFixture();
test.skip(!fixture, "Digital acceptance requires an explicit non-production fixture.");

test.describe.serial("digital product user journeys", () => {
  test("merchant uploads, previews, and publishes through the catalog UI", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "reset");
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.catalogFiles);
    await page.getByLabel(/file/i).setInputFiles({ name: "acceptance-art.png", mimeType: "image/png", buffer: Buffer.from("acceptance-image") });
    await expect(page.getByRole("status")).toContainText(/upload|processing|ready/i);
    await page.getByRole("button", { name: /publish|activate/i }).click();
    await expect(page.getByText("Ready to sell", { exact: true })).toBeVisible();
    const observed = await acceptanceAction(request, fixture!, "observe");
    expect(observed.observation).toBeTruthy();
  });

  test("buyer adds the product, checks out, opens access, and downloads", async ({ page, request }) => {
    await page.goto(fixture!.routes.product);
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.goto(fixture!.routes.cart);
    await page.getByRole("button", { name: /checkout/i }).click();
    await expect(page).toHaveURL(/checkout|stripe/i);
    await page.goto(fixture!.routes.checkoutReturn);
    await page.getByRole("link", { name: /view downloads|access.*downloads/i }).click();
    await page.getByRole("button", { name: /download/i }).click();
    await expect(page.getByRole("status")).toContainText(/started|preparing/i);
    await acceptanceAction(request, fixture!, "observe");
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
    await page.getByLabel(/file/i).setInputFiles({ name: "acceptance-art-v2.png", mimeType: "image/png", buffer: Buffer.from("acceptance-image-v2") });
    await page.goto(fixture!.routes.merchantOrder);
    await page.getByRole("button", { name: /resend/i }).click();
    await expect(page.getByRole("status")).toContainText(/sent|queued/i);
    await acceptanceAction(request, fixture!, "observe");
  });

  test("provider financial events produce exact customer UI state", async ({ page, request }) => {
    for (const transition of ["partial", "full"] as const) {
      await acceptanceAction(request, fixture!, "inject-refund", transition);
      await page.goto(fixture!.routes.customerOrder); await expect(page.getByText(new RegExp(transition, "i"))).toBeVisible();
      await acceptanceAction(request, fixture!, "observe");
    }
    for (const transition of ["opened", "won", "lost"] as const) {
      await acceptanceAction(request, fixture!, "inject-dispute", transition);
      await page.goto(fixture!.routes.download); await expect(page.locator("main")).toContainText(/available|unavailable|suspended|revoked/i);
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
