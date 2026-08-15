import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./accessibility-helpers";
import {
  acceptanceAction,
  dismissCookieBannerIfPresent,
  getDeliveredAccessMessage,
  loadDigitalAcceptanceFixture,
  signIn,
} from "./digital-products-fixture";

const acceptance = loadDigitalAcceptanceFixture();
test.skip(!acceptance, "Digital accessibility acceptance requires a non-production seeded fixture.");

async function tabTo(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, limit = 80) {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement).catch(() => false)) return;
  }
  throw new Error("Target was not reachable in the real keyboard tab order.");
}

async function mintRecoveryAccessLink(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  orderId: string,
) {
  // The buyer's real self-service path to a fresh link; earlier passes may
  // have exhausted or revoked older emailed links for this order.
  const requestedAt = Date.now();
  const response = await page.request.post("/api/digital-downloads/request-link", {
    headers: { origin: new URL(acceptance!.baseUrl).origin },
    data: { orderId, email: acceptance!.customer.email },
  });
  if (!response.ok()) throw new Error(`Recovery link request failed with ${response.status()}.`);
  return getDeliveredAccessMessage(request, acceptance!, orderId, ["customer_recovery", "merchant_resend", "purchase"], { sentAfterMs: requestedAt - 5_000 });
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

    test("public buyer surfaces pass axe and remain usable at 200% zoom", async ({ page, request }) => {
      test.setTimeout(600_000);
      // Bare /downloads has no access context; the real buyer surface is the
      // emailed fragment link. Use an order with remaining download grants.
      const accessMessage = await mintRecoveryAccessLink(page, request, acceptance!.financialOrders.disputeWon);
      for (const [label, route] of [
        ["product", acceptance!.routes.product],
        ["cart", acceptance!.routes.cart],
        ["checkoutReturn", acceptance!.routes.checkoutReturn],
        ["download", accessMessage.link],
        ["recovery", acceptance!.routes.recovery],
      ] as const) {
        await page.goto(route);
        await dismissCookieBannerIfPresent(page);
        await expect(page.locator("body")).toBeVisible();
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} ${label}`);
        // WCAG 1.4.10 requires reflow without loss down to a 320 CSS px
        // equivalent viewport; below that (e.g. 390px at 200%) even compliant
        // layouts overflow. Zoom to the standard's floor - a full 200% on
        // desktop - and keep every zoomed usability check at that level.
        const reflowZoom = Math.min(2, viewport.width / 320);
        await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, reflowZoom);
        await expect(page.locator("body")).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), { timeout: 10_000 })
          .toBe(true);
        if (label === "cart") {
          // The checkout form requires buyer identity and digital-delivery
          // consent before the hosted payment redirect.
          await page.getByPlaceholder("First name").fill("Accept");
          await page.getByPlaceholder("Last name").fill("Buyer");
          await page.getByPlaceholder("you@example.com").fill(acceptance!.customer.email);
          await page.getByRole("checkbox", { name: /immediate digital delivery/i }).check();
        }
        const primaryAction = label === "product" ? page.getByRole("button", { name: /add to cart/i })
          : label === "cart" ? page.getByRole("button", { name: /^checkout$/i })
            : label === "recovery" ? page.getByRole("button", { name: /fresh link/i })
              : label === "download" ? page.getByRole("button", { name: /download/i }).first()
                : page.getByRole("link", { name: /back to cart|return to cart|continue shopping/i }).first();
        await expect(primaryAction).toBeVisible({ timeout: 30_000 });
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
          // The recovery endpoint answers uniformly by design; use an order
          // pair that no other surface exercises to stay inside its rate
          // limits across repeated runs.
          await page.getByLabel("Order ID").fill(viewport.name === "mobile" ? acceptance!.financialOrders.disputeLost : acceptance!.financialOrders.fullRefund);
          await page.getByLabel("Order email").fill(acceptance!.customer.email);
          await primaryAction.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("status")).toContainText("Check your email", { timeout: 30_000 });
        } else if (label === "download") {
          // One real grant-consuming press per suite run (mobile); the other
          // viewport answers with the interstitial shape so repeated runs
          // cannot exhaust the buyer's five lifetime grants.
          if (viewport.name !== "mobile") {
            await page.route("**/api/digital-downloads/file/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><head><title>Download starting</title></head><body>Your download is starting.</body></html>" }));
          }
          await page.keyboard.press("Enter");
          await expect(page.getByRole("status")).toContainText(/download started|Preparing/, { timeout: 30_000 });
          if (viewport.name !== "mobile") await page.unroute("**/api/digital-downloads/file/**");
        } else if (label === "cart") {
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 60_000 });
        } else if (label === "checkoutReturn") {
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/(cart|products)/, { timeout: 30_000 });
        }
        await page.evaluate(() => { document.documentElement.style.zoom = "1"; }).catch(() => undefined);
      }
    });

    test("authenticated customer and merchant surfaces pass axe", async ({ page }) => {
      test.setTimeout(300_000);
      await signIn(page, acceptance!.customer.email, acceptance!.customer.password);
      await page.goto(acceptance!.routes.customerOrder);
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} customerOrder`);
      await page.request.post("/api/auth/signout");
      await signIn(page, acceptance!.merchant.email, acceptance!.merchant.password);
      for (const [label, route] of Object.entries(acceptance!.routes).filter(([key]) => ["catalogFiles", "merchantOrder"].includes(key))) {
        await page.goto(route);
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} ${label}`);
      }
    });

    test("keyboard focus and status announcements remain perceivable", async ({ page }) => {
      test.setTimeout(600_000);
      await page.goto(acceptance!.routes.recovery);
      await dismissCookieBannerIfPresent(page);
      const order: string[] = [];
      // Chromium parks the first Tab stop on the scrollable document before
      // reaching interactive content; require four unique, visibly focused
      // interactive stops after skipping document-level focus.
      for (let index = 0; index < 8 && order.length < 4; index += 1) {
        await page.keyboard.press("Tab");
        const onDocument = await page.evaluate(() => document.activeElement === document.body || document.activeElement === document.documentElement);
        if (onDocument) continue;
        const focused = page.locator(":focus-visible").last();
        await expect(focused).toBeVisible();
        order.push(await focused.evaluate((node) => node.id || node.textContent?.trim() || node.getAttribute("aria-label") || ""));
      }
      expect(order.length).toBe(4);
      expect(new Set(order).size).toBe(order.length);
      await page.getByLabel("Order ID").fill("invalid");
      await page.getByLabel("Order email").fill("invalid");
      const recoveryButton = page.getByRole("button", { name: "Email me a fresh link" });
      await recoveryButton.focus();
      await expect(recoveryButton).toBeFocused();
      await page.keyboard.press("Enter");
      // Exclude Next.js's empty route announcer, which also has role=alert.
      const alert = page.getByRole("alert").filter({ hasText: "Enter the full order ID" });
      await expect(alert).toBeVisible();
      await expect(alert).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByLabel("Order email")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(recoveryButton).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} recovery dynamic error`);

      await page.getByLabel("Order ID").fill(viewport.name === "mobile" ? acceptance!.financialOrders.disputeWon : acceptance!.financialOrders.disputeOpened);
      await page.getByLabel("Order email").fill(acceptance!.customer.email);
      await recoveryButton.press("Enter");
      const recoveryStatus = page.getByRole("status");
      await expect(recoveryStatus).toContainText("Check your email", { timeout: 30_000 });
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} recovery success`);

      await signIn(page, acceptance!.merchant.email, acceptance!.merchant.password);
      await page.goto(acceptance!.routes.catalogFiles);
      await page.keyboard.press("Escape");
      await page
        .getByRole("row", { name: /Acceptance Digital Print/i })
        .getByText("Acceptance Digital Print", { exact: true })
        .click();
      await expect(page.getByRole("heading", { name: "Acceptance Digital Print" })).toBeVisible();
      await page.getByRole("tab", { name: "Files" }).click();
      const fileInput = page.getByLabel("Add customer download files");
      await tabTo(page, fileInput, 120);
      await expect(fileInput).toBeFocused();
      // Unique per run: repeated acceptance passes must not accumulate
      // ambiguous same-label assets.
      const keyboardArtLabel = `keyboard art ${Date.now().toString(36)}`;
      await fileInput.setInputFiles({ name: `${keyboardArtLabel.replaceAll(" ", "-")}.png`, mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
      await expect(page.getByText("Customer file is ready.").first()).toBeVisible({ timeout: 60_000 });
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} upload dynamic state`);
      // The product is already live: the publish control must expose that
      // state rather than offering a second publish.
      await page.getByRole("tab", { name: "Overview" }).click();
      await expect(page.getByText(/Ready for your storefront|steps remaining/).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Published|Publish product/ })).toBeDisabled();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} catalog publish state`);
      await page.getByRole("tab", { name: "Files" }).click();

      const actions = page.getByRole("button", { name: `Manage ${keyboardArtLabel}` }).first();
      await actions.scrollIntoViewIfNeeded();
      await actions.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: "Replace file" }).click();
      await page.getByLabel(`Choose a replacement for ${keyboardArtLabel}`).setInputFiles({ name: "replacement-keyboard.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
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
      await actions.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: "Replace file" }).click();
      await page.getByLabel(`Choose a replacement for ${keyboardArtLabel}`).setInputFiles({ name: "replacement-confirm.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /replace file/i }).press("Enter");
      await expect(dialog).toBeHidden();
      await expect(page.getByText("Customer file replaced. Existing purchases still use their original version.").first()).toBeVisible({ timeout: 60_000 });
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} replace dynamic state`);

      await page.goto(acceptance!.routes.merchantOrder.replace(acceptance!.orderId, acceptance!.financialOrders.partialRefund));
      const resend = page.getByRole("button", { name: /send fresh access link|resend|retry/i });
      await resend.scrollIntoViewIfNeeded();
      await tabTo(page, resend, 120);
      await resend.press("Enter");
      await expect(page.getByRole("status")).toContainText(/sent|queued/i, { timeout: 30_000 });
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} merchant resend result`);
    });

    test("financial access states expose exact live status under guarded provisioning", async ({ page, request }) => {
      test.setTimeout(300_000);
      await signIn(page, acceptance!.customer.email, acceptance!.customer.password);
      for (const state of [
        { orderId: acceptance!.financialOrders.disputeOpened, transition: "opened", text: "Downloads are temporarily unavailable while a payment dispute is reviewed. Your download grants are preserved." },
        { orderId: acceptance!.financialOrders.disputeWon, transition: "won", text: "Opening this order creates a private 15-minute access session" },
        { orderId: acceptance!.financialOrders.disputeLost, transition: "lost", text: "Download access was removed after the payment dispute was decided against this order. Contact the store if you believe this is a mistake." },
        { orderId: acceptance!.financialOrders.partialRefund, transition: "partial", text: "Opening this order creates a private 15-minute access session" },
        { orderId: acceptance!.financialOrders.fullRefund, transition: "full", text: "Download access was removed after this order was fully refunded. Contact the store if you believe this is a mistake." },
      ]) {
        await acceptanceAction(request, acceptance!, "observe", undefined, state.orderId);
        await page.goto(`/order/${state.orderId}`);
        await expect(page.locator('[role="status"][aria-live="polite"]').filter({ hasText: state.text }).first()).toContainText(state.text);
        await expectNoSeriousAccessibilityViolations(page, `${viewport.name} ${state.transition} financial state`);
      }
    });

    test("failure, retry, limit, and timeout states remain announced and keyboard recoverable", async ({ page, request }) => {
      test.setTimeout(600_000);
      await signIn(page, acceptance!.merchant.email, acceptance!.merchant.password);
      await acceptanceAction(request, acceptance!, "inject-delivery-failure");
      await page.goto(acceptance!.routes.merchantOrder);
      // The order detail opens in a flyout portalled outside <main>.
      await expect(page.getByText(/Delivery needs attention/i).first()).toBeVisible({ timeout: 30_000 });
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} delivery failure`);
      // A resend-eligible order (delivery succeeded, access active) exercises
      // the announced provider failure path via a mocked 503.
      const resendOrderId = acceptance!.financialOrders.partialRefund;
      await page.goto(acceptance!.routes.merchantOrder.replace(acceptance!.orderId, resendOrderId));
      await page.route(`**/api/orders/${resendOrderId}/digital-delivery/resend`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fresh link delivery is temporarily unavailable." }) }));
      const resend = page.getByRole("button", { name: /send fresh access link|resend|retry/i });
      await resend.scrollIntoViewIfNeeded();
      await tabTo(page, resend, 120);
      await resend.press("Enter");
      const resendAlert = page.getByRole("alert").filter({ hasText: "Fresh link delivery is temporarily unavailable." });
      await expect(resendAlert).toBeVisible();
      await expect(resendAlert).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: "Try sending again" })).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} resend error`);
      await page.unroute(`**/api/orders/${resendOrderId}/digital-delivery/resend`);

      await page.request.post("/api/auth/signout");
      await acceptanceAction(request, acceptance!, "inject-signing-failure");
      const mainAccess = await getDeliveredAccessMessage(request, acceptance!, acceptance!.orderId, ["merchant_resend", "customer_recovery", "purchase"]);
      await page.goto(mainAccess.link);
      const download = page.getByRole("button", { name: /download/i }).first();
      await expect(download).toBeVisible({ timeout: 30_000 });
      await download.scrollIntoViewIfNeeded();
      await tabTo(page, download);
      await download.press("Enter");
      await expect(page.getByRole("status")).toContainText(/Unable to prepare download|could not be downloaded|try again/i, { timeout: 30_000 });
      await expect(download).toBeEnabled();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} signing failure`);

      await page.route("**/api/digital-downloads/file/**", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "download_limit_reached", error: "Download limit reached" }) }));
      await download.press("Space");
      await expect(page.getByRole("status")).toContainText("Download limit reached", { timeout: 30_000 });
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

    test("keyboard buyer workflow preserves focus order through cart and download", async ({ page, request }) => {
      test.setTimeout(600_000);
      await page.goto(acceptance!.routes.product);
      await dismissCookieBannerIfPresent(page);
      const add = page.getByRole("button", { name: /add to cart/i });
      await tabTo(page, add);
      await page.keyboard.press("Space");
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} product added`);
      await page.goto(acceptance!.routes.cart);
      await page.getByPlaceholder("First name").fill("Accept");
      await page.getByPlaceholder("Last name").fill("Buyer");
      await page.getByPlaceholder("you@example.com").fill(acceptance!.customer.email);
      await page.getByRole("checkbox", { name: /immediate digital delivery/i }).check();
      const checkout = page.getByRole("button", { name: /^checkout$/i });
      await tabTo(page, checkout);
      await expect(checkout).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} populated cart`);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 60_000 });

      // Reuse the link minted by the public-surfaces pass (which always runs
      // earlier in the suite) rather than spending another recovery request.
      const accessMessage = await getDeliveredAccessMessage(request, acceptance!, acceptance!.financialOrders.disputeWon, ["customer_recovery", "merchant_resend", "purchase"]);
      await page.goto(accessMessage.link);
      const download = page.getByRole("button", { name: /download/i }).first();
      await expect(download).toBeVisible({ timeout: 30_000 });
      await download.scrollIntoViewIfNeeded();
      await tabTo(page, download);
      // The public-surfaces pass already exercises a real grant-consuming
      // download; answer this keyboard press with the same interstitial shape
      // so repeated accessibility passes cannot exhaust the buyer's five
      // lifetime grants.
      await page.route("**/api/digital-downloads/file/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><head><title>Download starting</title></head><body>Your download is starting.</body></html>" }));
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText(/started|preparing/i, { timeout: 30_000 });
      await expect(download).toBeFocused();
      await expectNoSeriousAccessibilityViolations(page, `${viewport.name} download result`);
      await page.unroute("**/api/digital-downloads/file/**");
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
