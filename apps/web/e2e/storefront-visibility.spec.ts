import { expect, test } from "@playwright/test";
import { activateStore, login, setStoreStatus, signupAndOnboard } from "./helpers";

test("storefront is hidden in draft and visible when store is active", async ({ page }) => {
  const identity = await signupAndOnboard(page);

  await setStoreStatus(page, "draft");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.goto(`/s/${identity.storeSlug}`);
  await expect(page.getByRole("heading", { name: /this storefront is coming soon/i })).toBeVisible();

  await login(page, identity.email, identity.password);
  await activateStore(page);
  await page.goto(`/dashboard/stores/${identity.storeSlug}`);
  await expect(page.getByRole("link", { name: /view storefront/i })).toBeVisible();
  await page.goto(`/s/${identity.storeSlug}`);
  await expect(page.getByRole("link", { name: /shop products/i })).toBeVisible();
});
