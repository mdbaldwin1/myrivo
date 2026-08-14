import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./accessibility-helpers";
import { login } from "./helpers";
import { acceptanceAction, loadDigitalAcceptanceFixture } from "./digital-products-fixture";

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
        const primaryAction = label === "product" ? page.getByRole("button", { name: /add to cart/i })
          : label === "cart" ? page.getByRole("button", { name: /checkout/i })
            : label === "recovery" ? page.getByRole("button", { name: /fresh link/i })
              : label === "download" ? page.getByRole("button", { name: /download/i }).first()
                : page.getByRole("link", { name: /view downloads|access.*downloads/i });
        await expect(primaryAction).toBeVisible();
        await primaryAction.scrollIntoViewIfNeeded();
        await tabTo(page, primaryAction);
        await expect(primaryAction).toBeFocused();
        const bounds = await primaryAction.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        if (label === "product") {
          await page.keyboard.press("Space");
          await expect(page.getByText(/added to cart|view cart/i).first()).toBeVisible();
        } else if (label === "recovery") {
          await page.getByLabel("Order ID").fill(acceptance!.orderId);
          await page.getByLabel("Order email").fill(acceptance!.customer.email);
          await primaryAction.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("status")).toContainText("Check your email");
        } else if (label === "download") {
          await page.keyboard.press("Enter");
          await expect(page.getByRole("status")).toContainText(/Download started|Preparing your download/);
        } else if (label === "cart") {
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/checkout\.stripe\.com/);
        } else if (label === "checkoutReturn") {
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/downloads/);
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
      await page.getByLabel("Order email").press("Tab");
      const recoveryButton = page.getByRole("button", { name: "Email me a fresh link" });
      await expect(recoveryButton).toBeFocused();
      await page.keyboard.press("Enter");
      const alert = page.getByRole("alert");
      await expect(alert).toContainText("Enter the full order ID");
      await expect(alert).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByLabel("Order email")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(recoveryButton).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} recovery dynamic error`);

      await page.getByLabel("Order ID").fill(acceptance!.orderId);
      await page.getByLabel("Order email").fill(acceptance!.customer.email);
      await recoveryButton.press("Enter");
      const recoveryStatus = page.getByRole("status");
      await expect(recoveryStatus).toContainText("Check your email");
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

      const actions = page.getByRole("button", { name: /manage/i }).first();
      await tabTo(page, actions);
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: "Replace file" }).click();
      await page.getByLabel(/choose a replacement/i).first().setInputFiles({ name: "replacement-keyboard.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const cancel = dialog.getByRole("button", { name: "Cancel" });
      const confirm = dialog.getByRole("button", { name: /replace/i });
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(actions).toBeFocused();
      await actions.press("Enter");
      await page.getByRole("menuitem", { name: "Replace file" }).click();
      await page.getByLabel(/choose a replacement/i).first().setInputFiles({ name: "replacement-confirm.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
      await dialog.getByRole("button", { name: /replace/i }).press("Enter");
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("status")).toContainText(/upload|processing|ready/i);
      await expect(actions).toBeFocused();

      await page.goto(acceptance!.routes.merchantOrder);
      const resend = page.getByRole("button", { name: /resend|retry/i });
      await tabTo(page, resend);
      await resend.press("Enter");
      await expect(page.getByRole("status")).toContainText(/sent|queued/i);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} merchant resend result`);
    });

    test("financial access states expose exact live status under guarded provisioning", async ({ page, request }) => {
      await login(page, acceptance!.customer.email, acceptance!.customer.password);
      for (const state of [
        { orderId: acceptance!.financialOrders.disputeOpened, transition: "opened", text: "Downloads are temporarily unavailable while a payment dispute is reviewed. Your download grants are preserved." },
        { orderId: acceptance!.financialOrders.disputeWon, transition: "won", text: "Opening this order creates a private 15-minute access session" },
        { orderId: acceptance!.financialOrders.disputeLost, transition: "lost", text: "Download access was removed after the payment dispute was decided against this order. Contact the store if you believe this is a mistake." },
        { orderId: acceptance!.financialOrders.partialRefund, transition: "partial", text: "Opening this order creates a private 15-minute access session" },
        { orderId: acceptance!.financialOrders.fullRefund, transition: "full", text: "Download access was removed after this order was fully refunded. Contact the store if you believe this is a mistake." },
      ]) {
        await acceptanceAction(request, acceptance!, "observe", undefined, state.orderId);
        await page.goto(acceptance!.routes.customerOrder.replace(acceptance!.orderId, state.orderId));
        await expect(page.locator('[role="status"][aria-live="polite"]').filter({ hasText: state.text }).first()).toContainText(state.text);
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} ${state.transition} financial state`);
      }
    });

    test("failure, retry, limit, and timeout states remain announced and keyboard recoverable", async ({ page, request }) => {
      await login(page, acceptance!.merchant.email, acceptance!.merchant.password);
      await acceptanceAction(request, acceptance!, "inject-delivery-failure");
      await page.goto(acceptance!.routes.merchantOrder);
      await expect(page.locator("main")).toContainText(/delivery needs attention|failed|retry/i);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} delivery failure`);
      const resendOrderId = acceptance!.financialOrders.disputeWon;
      await page.goto(acceptance!.routes.merchantOrder.replace(acceptance!.orderId, resendOrderId));
      await page.route(`**/api/orders/${resendOrderId}/digital-delivery/resend`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fresh link delivery is temporarily unavailable." }) }));
      const resend = page.getByRole("button", { name: /send fresh access link|resend|retry/i });
      await tabTo(page, resend);
      await resend.press("Enter");
      const resendAlert = page.getByRole("alert");
      await expect(resendAlert).toHaveText("Fresh link delivery is temporarily unavailable.");
      await expect(resendAlert).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: "Try sending again" })).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} resend error`);

      await page.request.post("/api/auth/signout");
      await acceptanceAction(request, acceptance!, "inject-signing-failure");
      await page.goto(acceptance!.routes.download);
      const download = page.getByRole("button", { name: /download/i }).first();
      await tabTo(page, download);
      await download.press("Enter");
      await expect(page.getByRole("status")).toContainText(/could not be downloaded|Please try again/);
      await expect(download).toBeEnabled();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} signing failure`);

      await page.route("**/api/digital-downloads/file/**", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Download limit reached" }) }));
      await download.press("Space");
      await expect(page.getByRole("status")).toContainText("Download limit reached");
      await expect(download).toBeEnabled();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} download limit`);
      await page.unroute("**/api/digital-downloads/file/**");

      await page.route("**/api/digital-downloads/file/**", async () => new Promise(() => undefined));
      await download.press("Enter");
      await expect(page.getByRole("status")).toContainText("did not respond", { timeout: 20_000 });
      await expect(download).toBeEnabled();
      await expect(download).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} download timeout`);
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
      await expect(download).toBeVisible();
      await tabTo(page, download);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText(/started|preparing/i);
      await expect(download).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} download result`);
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
