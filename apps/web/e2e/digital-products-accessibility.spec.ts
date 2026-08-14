import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./accessibility-helpers";
import { login } from "./helpers";
import { loadDigitalAcceptanceFixture } from "./digital-products-fixture";

const acceptance = loadDigitalAcceptanceFixture();
test.skip(!acceptance, "Digital accessibility acceptance requires a non-production seeded fixture.");

async function tabTo(page: import("@playwright/test").Page, target: import("@playwright/test").Locator) {
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement).catch(() => false)) return;
  }
  throw new Error("Target was not reachable in the real keyboard tab order.");
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const) {
  test.describe(`${viewport.name} digital accessibility`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("public buyer surfaces pass axe and remain usable at 200% zoom", async ({ page }) => {
      for (const [label, route] of Object.entries(acceptance!.routes).filter(([label]) =>
        ["product", "cart", "checkoutReturn", "download", "recovery"].includes(label),
      )) {
        await page.goto(route);
        await expect(page.locator("body")).toBeVisible();
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} ${label}`);
        await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
        await expect(page.locator("body")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
        const primaryAction = page.getByRole("button").or(page.getByRole("link")).last();
        if (await primaryAction.isVisible().catch(() => false)) {
          await primaryAction.scrollIntoViewIfNeeded();
          await tabTo(page, primaryAction);
          await expect(primaryAction).toBeFocused();
          const bounds = await primaryAction.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        }
        await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
      }
    });

    test("authenticated customer and merchant surfaces pass axe", async ({ page }) => {
      await login(page, acceptance!.customer.email, acceptance!.customer.password);
      await page.goto(acceptance!.routes.customerOrder);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} customerOrder`);
      await page.request.post("/api/auth/signout");
      await login(page, acceptance!.merchant.email, acceptance!.merchant.password);
      for (const [label, route] of Object.entries(acceptance!.routes).filter(([label]) => ["catalogFiles", "merchantOrder"].includes(label))) {
        await page.goto(route);
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} ${label}`);
      }
    });

    test("keyboard focus and status announcements remain perceivable", async ({ page }) => {
      await page.goto(acceptance!.routes.recovery);
      const order: string[] = [];
      for (let index = 0; index < 4; index += 1) {
        await page.keyboard.press("Tab");
        const focused = page.locator(":focus-visible");
        await expect(focused).toBeVisible();
        order.push(await focused.evaluate((node) => node.id || node.textContent?.trim() || node.getAttribute("aria-label") || ""));
      }
      expect(new Set(order).size).toBe(order.length);
      await page.getByLabel("Order ID").fill("invalid");
      await page.getByLabel("Order email").fill("invalid");
      await page.getByRole("button", { name: "Email me a fresh link" }).press("Enter");
      const alert = page.getByRole("alert");
      await expect(alert).toContainText("Enter the full order ID");
      await expect(alert).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} recovery dynamic error`);

      await page.getByLabel("Order ID").fill(acceptance!.orderId);
      await page.getByLabel("Order email").fill(acceptance!.customer.email);
      await page.getByRole("button", { name: "Email me a fresh link" }).press("Enter");
      const recoveryStatus = page.getByRole("status");
      await expect(recoveryStatus).toContainText(/check your email/i);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} recovery success`);

      await login(page, acceptance!.merchant.email, acceptance!.merchant.password);
      await page.goto(acceptance!.routes.catalogFiles);
      const fileInput = page.getByLabel(/file/i).first();
      await tabTo(page, fileInput);
      await expect(fileInput).toBeFocused();
      await fileInput.setInputFiles({ name: "keyboard-art.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
      await expect(page.getByRole("status")).toContainText(/upload|processing|ready/i);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} upload dynamic state`);
      const publish = page.getByRole("button", { name: /publish|activate/i });
      await tabTo(page, publish);
      await expect(publish).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Ready to sell", { exact: true })).toBeVisible();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} catalog keyboard state`);

      const replace = page.getByRole("button", { name: /replace/i }).first();
      await tabTo(page, replace);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const focusedBefore = await page.locator(":focus").evaluate((node) => node.outerHTML);
      await page.keyboard.press("Shift+Tab");
      await expect(page.locator(":focus")).toBeVisible();
      expect(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(replace).toBeFocused();
      expect(focusedBefore).toBeTruthy();

      await page.goto(acceptance!.routes.merchantOrder);
      const resend = page.getByRole("button", { name: /resend|retry/i });
      await tabTo(page, resend);
      await resend.press("Enter");
      await expect(page.getByRole("status")).toContainText(/sent|queued/i);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} merchant resend result`);
    });

    test("keyboard buyer workflow preserves focus order through cart and download", async ({ page }) => {
      await page.goto(acceptance!.routes.product);
      const add = page.getByRole("button", { name: /add to cart/i });
      await tabTo(page, add);
      await page.keyboard.press("Space");
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} product added`);
      await page.goto(acceptance!.routes.cart);
      const checkout = page.getByRole("button", { name: /checkout/i });
      await tabTo(page, checkout);
      await expect(checkout).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} populated cart`);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/checkout\.stripe\.com/);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} hosted payment`);

      await page.goto(acceptance!.routes.download);
      const download = page.getByRole("button", { name: /download/i }).first();
      if (await download.isVisible().catch(() => false)) {
        await tabTo(page, download);
        await page.keyboard.press("Enter");
        await expect(page.getByRole("status")).toContainText(/started|preparing/i);
        await expect(download).toBeFocused();
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} download result`);
      }
    });

    test("loading animation respects reduced motion while the asynchronous state is active", async ({ page }) => {
      await page.route("**/api/digital-downloads", async (route) => new Promise((resolve) => setTimeout(() => resolve(route.continue()), 1_000)));
      await page.goto(acceptance!.routes.download);
      const spinner = page.locator(".animate-spin").first();
      await expect(spinner).toBeVisible();
      expect(await spinner.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
    });
  });
}
