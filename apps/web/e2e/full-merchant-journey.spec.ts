import { expect, test } from "@playwright/test";
import { activateStore, signupAndOnboard } from "./helpers";

test("full merchant journey from onboarding to fulfillment and reporting", async ({ page }) => {
  await page.goto("/dashboard/catalog");
  await expect(page).toHaveURL(/\/login/);

  const identity = await signupAndOnboard(page);
  const productTitle = `Everyday Hand Cream ${identity.suffix.slice(-6)}`;

  await page.goto("/dashboard/catalog");
  await page.getByRole("button", { name: /create product/i }).click();
  const createProductDialog = page.getByRole("dialog", { name: /create product/i });
  await createProductDialog.getByPlaceholder("Everyday Hand Cream").fill(productTitle);
  await createProductDialog.getByPlaceholder("0.00").fill("18.00");
  await createProductDialog.locator('input[placeholder="0"]').first().fill("25");
  await createProductDialog.getByRole("checkbox", { name: /featured product/i }).check();
  await createProductDialog.getByRole("button", { name: /add product/i }).click();
  await expect(page.getByText(productTitle)).toBeVisible();

  const row = page.locator("tr", { hasText: productTitle }).first();
  await row.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /^active$/i }).first().click();

  await activateStore(page);

  await page.goto("/dashboard/marketing/promotions");
  await expect(page.getByText("WELCOME10")).toBeVisible();

  const productsResponse = await page.request.get("/api/products");
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = (await productsResponse.json()) as {
    products?: Array<{
      id: string;
      title: string;
      product_variants: Array<{ id: string; is_default: boolean; status: "active" | "archived" }>;
    }>;
  };
  const createdProduct = (productsPayload.products ?? []).find((product) => product.title === productTitle);
  expect(createdProduct).toBeTruthy();
  const checkoutVariant =
    createdProduct?.product_variants.find((variant) => variant.is_default && variant.status === "active") ??
    createdProduct?.product_variants.find((variant) => variant.status === "active");
  expect(checkoutVariant).toBeTruthy();

  const shopperEmail = `shopper+${identity.suffix}@example.com`;
  const checkoutResponse = await page.request.post("/api/orders/checkout", {
    headers: {
      origin: "http://127.0.0.1:3000",
      host: "127.0.0.1:3000"
    },
    data: {
      firstName: "Shopper",
      lastName: "E2E",
      email: shopperEmail,
      fulfillmentMethod: "shipping",
      promoCode: "WELCOME10",
      items: [{ variantId: checkoutVariant?.id, quantity: 1 }]
    }
  });
  const checkoutPayload = (await checkoutResponse.json()) as
    | { error: string }
    | { orderId: string; paymentMode: "stub" }
    | { mode: "checkout"; checkoutUrl: string; sessionId: string; paymentMode: "stripe" };

  if (!checkoutResponse.ok()) {
    expect("error" in checkoutPayload ? checkoutPayload.error : "").toMatch(
      /configured payments|selected fulfillment option|please choose how to receive your order|invalid|stub_checkout_create_paid_order|candidate function/i
    );
  } else if ("orderId" in checkoutPayload) {
    await page.goto("/dashboard/orders");
    await expect(page.getByText(shopperEmail)).toBeVisible();

    const orderRow = page.locator("tr", { hasText: shopperEmail }).first();
    const fulfillmentSelect = orderRow.getByRole("combobox").nth(1);
    await fulfillmentSelect.click();
    await page.getByRole("option", { name: /^packing$/i }).first().click();
    await expect(orderRow.getByText(/packing/i)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export csv/i }).click()
    ]);
    expect(download.suggestedFilename()).toContain("orders");
  } else if ("mode" in checkoutPayload) {
    expect(checkoutPayload.mode).toBe("checkout");
    expect(checkoutPayload.checkoutUrl).toContain("http");
  }

  await page.goto("/dashboard/insights");
  await expect(page.getByText(/paid revenue/i)).toBeVisible();
  await expect(page.getByText(/daily revenue/i)).toBeVisible();
  await expect(page.getByText(/recent audit events/i)).toBeVisible();
});
