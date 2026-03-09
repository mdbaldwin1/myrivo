import { expect, test } from "@playwright/test";
import { activateStore, login, setStoreStatus, signupAndOnboard } from "./helpers";

test("storefront is hidden in draft and visible when store is active", async ({ page }) => {
  const identity = await signupAndOnboard(page);

  await setStoreStatus(page, "draft");

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /preview storefront/i })).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/s/${identity.storeSlug}`);
  await expect(page.getByText(/this page could not be found/i)).toBeVisible();

  await login(page, identity.email, identity.password);
  await activateStore(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /view storefront/i })).toBeVisible();
  await page.goto(`/s/${identity.storeSlug}`);
  await expect(page.getByRole("button", { name: /^add$/i }).first()).toBeVisible();
});
