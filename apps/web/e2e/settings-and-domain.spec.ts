import { expect, test } from "@playwright/test";
import { signupAndOnboard } from "./helpers";

test("merchant can update profile, branding, and checkout rules", async ({ page }) => {
  await signupAndOnboard(page);
  await page.goto("/dashboard/store-settings/profile");

  await page.getByPlaceholder("At Home Apothecary").fill("At Home Apothecary");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/store profile saved/i)).toBeVisible();

  await page.goto("/dashboard/store-settings/branding");
  await page.getByPlaceholder("#0F7B84").fill("#7A3A1A");
  await page.getByPlaceholder("#1AA3A8").fill("#C7662E");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/branding settings saved/i)).toBeVisible();

  await page.goto("/dashboard/store-settings/checkout-rules");
  await page.getByPlaceholder("Small-batch orders ship in 2-4 business days").fill("Orders ship in 1-2 business days.");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/checkout and fulfillment settings saved/i)).toBeVisible();
});
