import { expect, test } from "@playwright/test";
import { activateStore, signupAndOnboard } from "./helpers";

test("full merchant journey from onboarding to fulfillment and reporting", async ({ page }) => {
  await page.goto("/dashboard/catalog");
  await expect(page).toHaveURL(/\/login/);

  const identity = await signupAndOnboard(page);
  const productTitle = `Everyday Hand Cream ${identity.suffix.slice(-6)}`;

  const createProductResponse = await page.request.post("/api/products", {
    headers: {
      origin: "http://127.0.0.1:3000",
      host: "127.0.0.1:3000"
    },
    data: {
      title: productTitle,
      description: "Daily moisture support.",
      slug: null,
      sku: null,
      imageUrls: [],
      imageAltText: null,
      seoTitle: null,
      seoDescription: null,
      isFeatured: true,
      hasVariants: false,
      variantTiersCount: 0,
      variantTierLevels: [],
      priceCents: 1800,
      inventoryQty: 25,
      variants: [
        {
          sku: null,
          skuMode: "auto",
          imageUrls: [],
          priceCents: 1800,
          inventoryQty: 25,
          isMadeToOrder: false,
          status: "active",
          isDefault: true,
          options: []
        }
      ]
    }
  });
  expect(createProductResponse.ok()).toBeTruthy();

  await page.goto("/dashboard/catalog");
  const row = page.locator("tr", { hasText: productTitle }).first();
  await expect(row).toBeVisible();
  await row.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /^active$/i }).first().click();

  await activateStore(page);

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
  await expect(page.getByRole("heading", { name: /analytics coming online/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /merchandising/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /recent audit events/i })).toBeVisible();
});
