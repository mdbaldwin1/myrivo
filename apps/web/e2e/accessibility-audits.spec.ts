import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./accessibility-helpers";
import { login, querySingleStoreOwnerIdentity } from "./helpers";

function resolveStoreSlug() {
  return (process.env.MYRIVO_SINGLE_STORE_SLUG || "at-home-apothecary").trim().toLowerCase();
}

test("public storefront, privacy, and checkout surfaces avoid serious accessibility violations", async ({ page }) => {
  const storeSlug = resolveStoreSlug();
  const routes = [
    `/s/${storeSlug}?store=${storeSlug}`,
    `/privacy?store=${storeSlug}`,
    `/cookies?store=${storeSlug}`,
    `/cart?store=${storeSlug}`,
    `/checkout?store=${storeSlug}`,
    "/accessibility"
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page, route);
  }
});

test("dashboard shell avoids serious accessibility violations for signed-in store operators", async ({ page }) => {
  const identity = await querySingleStoreOwnerIdentity();
  await login(page, identity.email, identity.password);

  await page.goto("/dashboard");
  if (await page.getByRole("heading", { name: /legal update required/i }).isVisible().catch(() => false)) {
    await page.getByRole("checkbox", { name: /i have read and accept the required legal updates/i }).check();
    await page.getByRole("button", { name: /accept and continue/i }).click();
  }

  await expect(page).toHaveURL(/\/dashboard/);
  await expectNoSeriousAccessibilityViolations(page, "dashboard");
});
