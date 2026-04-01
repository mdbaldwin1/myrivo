import { expect, test } from "@playwright/test";
import { login, querySingleStoreOwnerIdentity } from "./helpers";

test("dashboard uses fixed-shell layout on desktop routes", async ({ page }) => {
  const credentials = await querySingleStoreOwnerIdentity();
  await login(page, credentials.email, credentials.password);

  await page.goto("/dashboard/catalog");
  await expect(page).toHaveURL(/\/dashboard\/stores\/[^/]+\/catalog/);
  const shell = page.locator('[data-dashboard-shell="true"]');
  await expect(shell).toHaveClass(/fixed/);
  await expect(shell).toHaveClass(/overflow-hidden/);

  const scrollContainer = page.locator('[data-dashboard-scroll-container="true"]');
  await expect(scrollContainer).toBeVisible();
  await expect(scrollContainer).toHaveClass(/overflow-y-auto/);

  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();

  await page.goto("/dashboard/catalog");
  await expect(page.getByRole("heading", { name: "Catalog and Inventory" })).toBeVisible();

  await page.goto("/dashboard/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile drawer navigation opens and closes when navigating", async ({ page }) => {
    const credentials = await querySingleStoreOwnerIdentity();
    await login(page, credentials.email, credentials.password);

    await page.goto("/dashboard/catalog");
    await expect(page).toHaveURL(/\/dashboard\/stores\/[^/]+\/catalog/);

    const menuButton = page.getByRole("button", { name: /open dashboard navigation menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const navDialog = page.getByRole("dialog", { name: "Dashboard Navigation" });
    await expect(navDialog).toBeVisible();

    await navDialog.getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/dashboard\/stores\/[^/]+\/orders/);
    await expect(navDialog).toBeHidden();
  });
});
