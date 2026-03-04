import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { login } from "./helpers";

function readOwnerCredentials() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const values = Object.fromEntries(
    lines
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) {
          return null;
        }
        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)
  );

  const email = values.E2E_OWNER_EMAIL?.trim();
  const password = values.E2E_OWNER_PASSWORD?.trim();
  if (!email || !password) {
    return null;
  }

  return { email, password };
}

test("dashboard uses fixed-shell layout on desktop routes", async ({ page }) => {
  const credentials = readOwnerCredentials();
  test.skip(!credentials, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD are required for dashboard shell tests.");
  await login(page, credentials!.email, credentials!.password);

  await page.goto("/dashboard/catalog");
  await expect(page).toHaveURL(/\/dashboard\/catalog/);
  const shell = page.locator('[data-dashboard-shell="true"]');
  await expect(shell).toHaveClass(/h-\[100dvh\]/);

  const scrollContainer = page.locator('[data-dashboard-scroll-container="true"]');
  await expect(scrollContainer).toBeVisible();
  await expect(scrollContainer).toHaveClass(/overflow-y-auto/);

  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();

  await page.goto("/dashboard/catalog");
  await expect(page.getByRole("heading", { name: "Catalog and Inventory" })).toBeVisible();
  await expect(page.locator("header.sticky").first()).toBeVisible();

  await page.goto("/dashboard/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.locator("header.sticky").first()).toBeVisible();
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile drawer navigation opens and closes when navigating", async ({ page }) => {
    const credentials = readOwnerCredentials();
    test.skip(!credentials, "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD are required for dashboard shell tests.");
    await login(page, credentials!.email, credentials!.password);

    await page.goto("/dashboard/catalog");
    await expect(page).toHaveURL(/\/dashboard\/catalog/);

    const menuButton = page.getByRole("button", { name: /open dashboard navigation menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const navDialog = page.getByRole("dialog", { name: "Dashboard Navigation" });
    await expect(navDialog).toBeVisible();

    await navDialog.getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders/);
    await expect(navDialog).toBeHidden();
  });
});
