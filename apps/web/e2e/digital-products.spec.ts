import { expect, test } from "@playwright/test";
import { acceptanceAction, loadDigitalAcceptanceFixture } from "./digital-products-fixture";
import { login } from "./helpers";

const fixture = loadDigitalAcceptanceFixture();
test.skip(!fixture, "Digital acceptance requires an explicit non-production fixture.");

test.describe.serial("digital product executable acceptance", () => {
  test("merchant creates, uploads, previews, and publishes through the catalog", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "reset", { environment: "nonproduction" });
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.catalogFiles);
    await acceptanceAction(request, fixture!, "merchant-upload-publish", { productStatus: "active", previewStatus: "ready" });
    await page.reload();
    await expect(page.getByText("Ready to sell", { exact: true })).toBeVisible();
  });

  test("completes digital-only and mixed Stripe payments and Resend delivery", async ({ page, request }) => {
    for (const action of ["stripe-digital-only", "stripe-mixed"]) {
      const result = await acceptanceAction(request, fixture!, action, { paymentStatus: "paid", deliveryStatus: "succeeded", emailStatus: "sent" });
      expect(result.providerEventId).toMatch(/^evt_/);
    }
    await page.goto(fixture!.routes.checkoutReturn);
    await expect(page.getByRole("link", { name: /access.*downloads/i })).toHaveAttribute("href", "/downloads");
  });

  test("executes access, five grants, grace, expiration, recovery, and replacement", async ({ page, request }) => {
    await page.goto(fixture!.routes.download);
    for (let index = 1; index <= 5; index += 1) await acceptanceAction(request, fixture!, "download-grant", { issuedCount: index });
    await acceptanceAction(request, fixture!, "download-grace-reuse", { issuedCount: 5 });
    await acceptanceAction(request, fixture!, "download-sixth-rejected", { denied: true });
    await acceptanceAction(request, fixture!, "replace-asset", { priorBuyerVersionPreserved: true });
    await acceptanceAction(request, fixture!, "expire-and-recover", { recoveryEmailStatus: "sent", grantsReset: false });
    await expect(page.getByRole("heading", { name: /your files/i })).toBeVisible();
  });

  test("executes financial access transitions", async ({ request }) => {
    await acceptanceAction(request, fixture!, "partial-refund", { access: "active" });
    await acceptanceAction(request, fixture!, "dispute-opened", { access: "suspended" });
    await acceptanceAction(request, fixture!, "dispute-won", { access: "active" });
    await acceptanceAction(request, fixture!, "dispute-lost", { access: "revoked" });
    await acceptanceAction(request, fixture!, "full-refund", { access: "revoked" });
  });

  test("injects delivery failure, durable retry, and merchant resend", async ({ page, request }) => {
    await acceptanceAction(request, fixture!, "delivery-fail", { deliveryStatus: "failed" });
    await acceptanceAction(request, fixture!, "delivery-retry", { deliveryStatus: "succeeded" });
    await acceptanceAction(request, fixture!, "merchant-resend", { emailStatus: "sent", grantsReset: false });
    await login(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.merchantOrder);
    await expect(page.getByText("Delivery sent", { exact: true })).toBeVisible();
  });
});
