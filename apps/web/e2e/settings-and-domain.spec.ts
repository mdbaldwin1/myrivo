import { expect, test } from "@playwright/test";
import { signupAndOnboard } from "./helpers";

test("merchant can update profile, branding, and checkout rules", async ({ page }) => {
  const identity = await signupAndOnboard(page);
  await page.goto(`/dashboard/stores/${identity.storeSlug}/store-settings/general`);

  await page.getByRole("textbox", { name: "Store Name" }).fill("Sunset Mercantile");
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/store profile saved/i)).toBeVisible();

  await page.goto(`/dashboard/stores/${identity.storeSlug}/store-settings/fulfillment`);
  await page.getByRole("textbox", { name: "Shipping Label" }).fill("Fast shipping");
  await page.getByRole("spinbutton", { name: "Shipping Fee (cents)" }).fill("750");
  await page.getByRole("button", { name: /save fulfillment settings/i }).click();
  await expect(page.getByText(/fulfillment settings saved/i)).toBeVisible();
});
