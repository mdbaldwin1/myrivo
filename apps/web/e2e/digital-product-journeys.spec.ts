import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { deflateSync } from "node:zlib";
import {
  acceptanceAction,
  acceptanceSessionHash,
  dismissCookieBannerIfPresent,
  dismissToasts,
  getDeliveredAccessMessage,
  getStripeCheckoutEvidence,
  getStripeRefund,
  loadDigitalAcceptanceFixture,
  runSupportedStripeDisputeScenario,
  signIn,
} from "./digital-products-fixture";
import { expectNoSeriousAccessibilityViolations } from "./accessibility-helpers";

const fixture = loadDigitalAcceptanceFixture();

// --- minimal valid PNG generator (distinct bytes per seed) ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function crc32(buffer: Buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
export function makeAcceptancePng(seed: number) {
  const width = 96;
  const height = 96;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const px = rowStart + 1 + x * 3;
      raw[px] = (31 * seed + x * 7 + y * 13) & 0xff;
      raw[px + 1] = (97 * seed) & 0xff;
      raw[px + 2] = (13 + 51 * seed) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}



// Every active file is snapshotted into later purchases, so the storefront
// scenarios need exactly the one canonical deliverable: clear this pass's
// extra file plus anything an interrupted pass left behind.
const CANONICAL_FILE_LABEL = "Manage acceptance print v1";

async function removeExtraAcceptanceFiles(page: Page) {
  for (let guard = 0; guard < 12; guard += 1) {
    const labels = await page
      .getByRole("button", { name: /^Manage / })
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") ?? ""));
    const target = labels.find((label) => label && label !== CANONICAL_FILE_LABEL);
    if (!target) return;
    await dismissToasts(page);
    await page.getByRole("button", { name: target, exact: true }).first().click();
    await page.getByRole("menuitem", { name: "Remove file" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove file" }).click();
    await expect(page.getByText("Customer file removed. Existing purchases are preserved.").first()).toBeVisible({ timeout: 30_000 });
    await dismissToasts(page);
  }
  throw new Error("Extra acceptance files were never fully cleared.");
}

async function selectDigitalProductInCatalog(page: Page) {
  await page.goto(fixture!.routes.catalogFiles);
  await page.keyboard.press("Escape");
  await page
    .getByRole("row", { name: /Acceptance Digital Print/i })
    .getByText("Acceptance Digital Print", { exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Acceptance Digital Print" })).toBeVisible();
}

async function completeStripeCheckout(page: Page) {
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  const email = page.locator('input[name="email"]');
  if (await email.isVisible().catch(() => false)) {
    if (!(await email.inputValue().catch(() => ""))) await email.fill(fixture!.customer.email);
  }
  const cardNumber = page.locator('input[name="cardNumber"]');
  const cardRadio = page.locator("#payment-method-accordion-item-title-card");
  await cardRadio.waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(2500);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await cardNumber.isVisible().catch(() => false)) break;
    await cardRadio.check({ force: true }).catch(() => undefined);
    await cardNumber.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  }
  await cardNumber.waitFor({ state: "visible", timeout: 5_000 });
  for (const checkbox of await page.locator('input[type="checkbox"]').all()) {
    if (await checkbox.isChecked().catch(() => false)) await checkbox.uncheck({ force: true }).catch(() => undefined);
  }
  await cardNumber.fill("4242424242424242");
  await page.locator('input[name="cardExpiry"]').fill("12 / 34");
  await page.locator('input[name="cardCvc"]').fill("123");
  const fills: Array<[string, string]> = [
    ["billingName", "Accept Buyer"],
    ["billingPostalCode", "12345"],
    ["shippingName", "Accept Buyer"],
    ["shippingAddressLine1", "123 Acceptance Way"],
    ["shippingLocality", "Springfield"],
    ["shippingPostalCode", "12345"],
  ];
  for (const [name, value] of fills) {
    const field = page.locator(`input[name="${name}"]`);
    if (await field.isVisible().catch(() => false)) {
      await field.fill(value);
      await page.keyboard.press("Escape").catch(() => undefined);
    }
  }
  const state = page.locator('select[name="shippingAdministrativeArea"]');
  if (await state.isVisible().catch(() => false)) await state.selectOption("NY").catch(() => undefined);
  await page.locator('button[type="submit"], .SubmitButton').first().click();
  await expect(page).toHaveURL(new RegExp(new URL(fixture!.baseUrl).host), { timeout: 90_000 });
  await expect(page.locator("main").first()).toContainText(/Order [0-9a-f-]{36} placed successfully/i, { timeout: 120_000 });
  const text = await page.locator("main").first().innerText();
  const orderId = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
  if (!orderId) throw new Error("Checkout return did not expose the newly completed order identity.");
  await expect(page.getByRole("link", { name: /view downloads|access.*downloads/i })).toBeVisible({ timeout: 120_000 });
  return orderId;
}

async function startCartCheckout(page: Page, options: { mixed?: boolean } = {}) {
  await page.goto(fixture!.routes.product);
  await dismissCookieBannerIfPresent(page);
  await page.evaluate(() => window.localStorage.removeItem("aha-cart:single-store"));
  await page.reload();
  await page.getByRole("button", { name: /add to cart/i }).click();
  if (options.mixed) {
    await page.goto(fixture!.routes.physicalProduct);
    await page.getByRole("button", { name: /add to cart/i }).click();
  }
  await page.goto(fixture!.routes.cart);
  await page.getByPlaceholder("First name").fill("Accept");
  await page.getByPlaceholder("Last name").fill("Buyer");
  if (options.mixed) {
    const phone = page.getByPlaceholder("Phone");
    if (await phone.isVisible().catch(() => false)) await phone.fill("5555550123");
  }
  await page.getByPlaceholder("you@example.com").fill(fixture!.customer.email);
  await page.getByRole("checkbox", { name: /immediate digital delivery/i }).check();
  await page.getByRole("button", { name: /^checkout$/i }).click();
}

async function buyThroughStorefront(page: Page, options: { mixed?: boolean } = {}) {
  await startCartCheckout(page, options);
  return completeStripeCheckout(page);
}

function waitForFileGrantResponse(page: Page) {
  return page.waitForResponse(
    (response) => response.url().includes("/api/digital-downloads/file/") && response.request().method() === "POST",
    { timeout: 30_000 },
  );
}

async function captureDownloadedFile(page: Page, click: () => Promise<void>) {
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error("Download did not produce a file.");
  const bytes = fs.readFileSync(filePath);
  return { filename: download.suggestedFilename(), sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function contextSessionHash(context: BrowserContext) {
  const cookies = await context.cookies();
  return acceptanceSessionHash(cookies.map((cookie) => `${cookie.name}:${cookie.value}`).join("|"));
}

const beforeTypes = null as unknown as {
  webhook: {
    stripe_event_id: string; event_type: string; status: string; signature_verified: boolean;
    attempt_count: number; last_attempt_at: string; processed_at: string | null; created_at: string;
  };
};

test.skip(!fixture, "Digital acceptance requires an explicit non-production fixture.");

test.describe.serial("digital product user journeys", () => {
  test("merchant manages files, readiness, and publish state through the catalog UI", async ({ page, request }) => {
    test.setTimeout(180_000);
    await signIn(page, fixture!.merchant.email, fixture!.merchant.password);
    await selectDigitalProductInCatalog(page);
    await page.getByRole("tab", { name: "Files" }).click();
    await page.getByLabel("Add customer download files").setInputFiles({
      name: "acceptance-extra.png",
      mimeType: "image/png",
      buffer: makeAcceptancePng(3),
    });
    await expect(page.getByText("Customer file is ready.").first()).toBeVisible({ timeout: 60_000 });
    // Keep the storefront on exactly one deliverable file: remove the file we
    // just uploaded (existing purchases keep their versions).
    await removeExtraAcceptanceFiles(page);
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByText("Ready for your storefront")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Published" })).toBeDisabled();
    const observed = await acceptanceAction(request, fixture!, "observe");
    expect(observed.observation).toBeTruthy();
  });

  test("buyer completes digital-only and mixed Stripe checkouts before access", async ({ page, request }) => {
    test.setTimeout(900_000);
    for (const composition of ["digital", "mixed"] as const) {
      const startedAt = Date.now();
      const orderId = await buyThroughStorefront(page, { mixed: composition === "mixed" });
      const message = await getDeliveredAccessMessage(request, fixture!, orderId, "purchase", { sentAfterMs: startedAt - 5_000 });
      expect(message.to).toContain(fixture!.customer.email);
      if (composition === "digital") {
        await acceptanceAction(request, fixture!, "observe", undefined, orderId, "resend-access", { kind: "resend", messageId: message.id, status: message.status, recipient: fixture!.customer.email, orderId, accessUrlHash: message.accessUrlHash, sentAt: message.sentAt });
      }
      await page.getByRole("link", { name: /view downloads|access.*downloads/i }).click();
      const downloadButton = page.getByRole("button", { name: /download/i }).first();
      await expect(downloadButton).toBeVisible({ timeout: 30_000 });
      if (composition === "digital") {
        const sessionHashes: string[] = [];
        let graceReusedGrantId = "";
        let graceCountBefore = -1;
        let graceCountAfter = -1;
        const beforeSigningFailure = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const signingFailureIssuedIdsBefore = beforeSigningFailure.observation.grants.filter((grant) => grant.status === "issued").map((grant) => grant.id);
        const signingFailureUsedBefore = beforeSigningFailure.observation.entitlements.reduce((sum, entitlement) => sum + entitlement.download_grants_used, 0);
        await acceptanceAction(request, fixture!, "inject-signing-failure", undefined, orderId);
        const failureContext = await page.context().browser()!.newContext();
        const failurePage = await failureContext.newPage();
        await failurePage.goto(message.link);
        await failurePage.getByRole("button", { name: /download/i }).click();
        await expect(failurePage.getByRole("status")).toContainText(/unable|could not be downloaded|try again/i, { timeout: 30_000 });
        await expectNoSeriousAccessibilityViolations(failurePage, "signing failure dynamic state");
        await failureContext.close();
        const afterInjectedFailure = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const signingFailureIssuedIdsAfter = afterInjectedFailure.observation.grants.filter((grant) => grant.status === "issued").map((grant) => grant.id);
        const signingFailureUsedAfter = afterInjectedFailure.observation.entitlements.reduce((sum, entitlement) => sum + entitlement.download_grants_used, 0);
        const releasedFaults = afterInjectedFailure.observation.grants.filter((grant) => grant.status === "released" && !beforeSigningFailure.observation.grants.some((beforeGrant) => beforeGrant.id === grant.id));
        if (JSON.stringify(signingFailureIssuedIdsAfter) !== JSON.stringify(signingFailureIssuedIdsBefore) || signingFailureUsedAfter !== signingFailureUsedBefore || releasedFaults.length !== 1) throw new Error("Signing failure did not release exactly one reservation without changing issued usage.");
        let sixthContext: BrowserContext | null = null;
        let sixthPage: Page | null = null;
        for (let index = 0; index < 5; index += 1) {
          const context = await page.context().browser()!.newContext();
          const sessionPage = await context.newPage();
          await sessionPage.goto(message.link);
          const sessionDownload = sessionPage.getByRole("button", { name: /download/i }).first();
          await expect(sessionDownload).toBeVisible({ timeout: 30_000 });
          if (index === 4) {
            // The download list hides the button once all grants are used, so
            // the sixth (denied) attempt must come from a surface loaded while
            // one grant was still available.
            sixthContext = await page.context().browser()!.newContext();
            sixthPage = await sixthContext.newPage();
            await sixthPage.goto(message.link);
            await expect(sixthPage.getByRole("button", { name: /download/i }).first()).toBeVisible({ timeout: 30_000 });
          }
          const grantResponse = waitForFileGrantResponse(sessionPage);
          await sessionDownload.click();
          expect((await grantResponse).status()).toBe(200);
          await expect(sessionPage.getByRole("status")).toContainText(/download started/i, { timeout: 30_000 });
          sessionHashes.push(await contextSessionHash(context));
          if (index === 0) {
            const beforeGrace = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
            const firstGrantId = beforeGrace.observation.grants.at(-1)?.id;
            graceCountBefore = beforeGrace.observation.grants.filter((grant) => grant.status === "issued").length;
            const graceResponse = waitForFileGrantResponse(sessionPage);
            await sessionDownload.click();
            expect((await graceResponse).status()).toBe(200);
            const grace = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
            graceReusedGrantId = grace.observation.grants.at(-1)?.id ?? "";
            graceCountAfter = grace.observation.grants.filter((grant) => grant.status === "issued").length;
            if (!firstGrantId || graceReusedGrantId !== firstGrantId || graceCountAfter !== graceCountBefore) throw new Error("Same-session grace did not reuse the same grant.");
          }
          await context.close();
        }
        const five = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        const corrupt = await page.context().browser()!.newContext();
        const corruptPage = await corrupt.newPage();
        await corruptPage.goto(message.link.replace(/.$/, "x"));
        await expect(corruptPage.getByText("This download link is no longer available")).toBeVisible({ timeout: 30_000 });
        await corrupt.close();
        await acceptanceAction(request, fixture!, "observe", undefined, orderId);
        if (!sixthContext || !sixthPage) throw new Error("Sixth download surface was not prepared.");
        const sixthResponse = sixthPage.waitForResponse((response) => response.url().includes("/api/digital-downloads/file/"));
        await sixthPage.getByRole("button", { name: /download/i }).first().click();
        const denied = await sixthResponse;
        const deniedBody = await denied.json() as { code?: string; error?: string };
        const sixthDeniedCode = "download_limit_reached";
        const sixthDeniedMessage = "Download limit reached";
        expect(denied.status()).toBe(409);
        expect(deniedBody).toEqual({ code: sixthDeniedCode, error: sixthDeniedMessage });
        await expect(sixthPage.getByText(sixthDeniedMessage, { exact: true })).toBeVisible();
        await expectNoSeriousAccessibilityViolations(sixthPage, "grant limit dynamic state");
        sessionHashes.push(await contextSessionHash(sixthContext));
        await sixthContext.close();
        const issued = five.observation.grants.filter((grant) => grant.status === "issued");
        const successfulRetryGrantId = issued.find((grant) => !signingFailureIssuedIdsAfter.includes(grant.id))?.id;
        if (!successfulRetryGrantId) throw new Error("No successful issued retry followed the released signing fault.");
        await acceptanceAction(request, fixture!, "observe", undefined, orderId, "five-grants", { kind: "grants", uniqueGrantIds: issued.map((grant) => grant.id), graceReusedGrantId, graceCountBefore, graceCountAfter, signingFailureIssuedIdsBefore, signingFailureIssuedIdsAfter, signingFailureUsedBefore, signingFailureUsedAfter, releasedFaultGrantId: releasedFaults[0]!.id, successfulRetryGrantId, sixthDeniedStatus: denied.status(), sixthDeniedCode, sixthDeniedMessage, sessionHashes, assetVersionId: issued[0]?.asset_version_id });
      } else {
        const grantResponse = waitForFileGrantResponse(page);
        await downloadButton.click();
        expect((await grantResponse).status()).toBe(200);
        await expect(page.getByRole("status")).toContainText(/started|preparing/i);
      }
      const beforeCheckoutEvidence = await acceptanceAction(request, fixture!, "observe", undefined, orderId);
      const checkoutEvidence = await getStripeCheckoutEvidence(request, beforeCheckoutEvidence.observation.providerPayment.id, orderId);
      const observation = await acceptanceAction(request, fixture!, "observe", undefined, orderId, composition === "digital" ? "stripe-digital" : "stripe-mixed", checkoutEvidence);
      expect(observation.observation?.order).toEqual(expect.objectContaining({ id: orderId, checkout_composition: composition === "digital" ? "digital_only" : "mixed" }));
    }
  });

  test("buyer requests recovery and merchant replaces/resends through UI", async ({ page, request }) => {
    test.setTimeout(900_000);
    const before = await acceptanceAction(request, fixture!, "observe");
    const priorVersion = before.observation.manifestItems[0];
    if (!priorVersion) throw new Error("Prior buyer manifest has no immutable asset version.");
    const priorMessage = await getDeliveredAccessMessage(request, fixture!, fixture!.orderId, ["purchase", "merchant_resend", "customer_recovery"]);
    const priorContext = await page.context().browser()!.newContext();
    const priorPage = await priorContext.newPage();
    await priorPage.goto(priorMessage.link);
    await expect(priorPage.getByRole("button", { name: /download/i }).first()).toBeVisible({ timeout: 30_000 });
    const priorDownload = await captureDownloadedFile(priorPage, () => priorPage.getByRole("button", { name: /download/i }).first().click());
    expect(priorDownload.filename).toBe(priorVersion.customer_filename);
    const priorContentSha256 = priorDownload.sha256;
    await priorContext.close();
    await page.goto(fixture!.routes.recovery);
    await dismissCookieBannerIfPresent(page);
    await page.getByLabel(/order id/i).fill(fixture!.orderId);
    await page.getByLabel(/order email/i).fill(fixture!.customer.email);
    const recoveryRequestedAt = Date.now();
    await page.getByRole("button", { name: /fresh link/i }).click();
    await expect(page.getByRole("status")).toContainText(/check your email/i, { timeout: 30_000 });
    // Issuing a recovery link revokes the buyer's earlier links, so the
    // post-replacement check has to open the link the buyer now holds.
    const refreshedMessage = await getDeliveredAccessMessage(request, fixture!, fixture!.orderId, ["customer_recovery"], { sentAfterMs: recoveryRequestedAt - 5_000 });
    await signIn(page, fixture!.merchant.email, fixture!.merchant.password);
    await selectDigitalProductInCatalog(page);
    await page.getByRole("tab", { name: "Files" }).click();
    await page.getByRole("button", { name: /^Manage / }).first().click();
    await page.getByRole("menuitem", { name: "Replace file" }).click();
    // Distinct bytes per run: a fixed seed would reproduce the bytes a prior
    // pass already published, so the replacement could not be told apart from
    // what the earlier buyer purchased.
    const replacementSeed = 8 + (Math.floor(Date.now() / 1000) % 240);
    await page.getByLabel(/choose a replacement/i).first().setInputFiles({ name: "acceptance-print-v2.png", mimeType: "image/png", buffer: makeAcceptancePng(replacementSeed) });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /replace file/i }).click();
    await expect(page.getByText("Customer file replaced. Existing purchases still use their original version.").first()).toBeVisible({ timeout: 60_000 });
    let replacementVersion: string | undefined;
    await expect
      .poll(async () => {
        const after = await acceptanceAction(request, fixture!, "observe");
        replacementVersion = after.observation.catalogAssetVersions.find((asset) => asset.current_version_id !== priorVersion.asset_version_id)?.current_version_id;
        return replacementVersion ?? "";
      }, { timeout: 60_000 })
      .not.toBe("");
    if (!replacementVersion) throw new Error("Replacement did not produce a new immutable asset version.");
    const buyer = await page.context().browser()!.newContext();
    const buyerPage = await buyer.newPage();
    const replacementOrderId = await buyThroughStorefront(buyerPage);
    const replacementOrder = await acceptanceAction(request, fixture!, "observe", undefined, replacementOrderId);
    const oldAfterContext = await page.context().browser()!.newContext();
    const oldAfterPage = await oldAfterContext.newPage();
    await oldAfterPage.goto(refreshedMessage.link);
    await expect(oldAfterPage.getByRole("button", { name: /download/i }).first()).toBeVisible({ timeout: 30_000 });
    const oldAfterDownload = await captureDownloadedFile(oldAfterPage, () => oldAfterPage.getByRole("button", { name: /download/i }).first().click());
    expect(oldAfterDownload.filename).toBe(priorVersion.customer_filename);
    const oldAfterHash = oldAfterDownload.sha256;
    await oldAfterContext.close();
    if (oldAfterHash !== priorContentSha256) throw new Error("Replacement changed the prior buyer's immutable file bytes.");
    const newMessage = await getDeliveredAccessMessage(request, fixture!, replacementOrderId, "purchase");
    const newContext = await page.context().browser()!.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto(newMessage.link);
    await expect(newPage.getByRole("button", { name: /download/i }).first()).toBeVisible({ timeout: 30_000 });
    const replacementDownload = await captureDownloadedFile(newPage, () => newPage.getByRole("button", { name: /download/i }).first().click());
    const replacementFilename = replacementOrder.observation.manifestItems.find((item) => item.asset_version_id === replacementVersion)?.customer_filename;
    if (!replacementFilename) throw new Error("Replacement manifest has no customer filename.");
    expect(replacementDownload.filename).toBe(replacementFilename);
    const replacementContentSha256 = replacementDownload.sha256;
    await newContext.close();
    if (replacementContentSha256 === priorContentSha256) throw new Error("Replacement checkout served the prior file bytes.");
    await buyer.close();
    if (!replacementOrder.observation.manifestItems.some((item) => item.asset_version_id === replacementVersion)) throw new Error("New checkout did not snapshot the replacement version.");
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "replacement", { kind: "replacement", priorAssetVersionId: priorVersion.asset_version_id, replacementAssetVersionId: replacementVersion, oldBeforeFilename: priorVersion.customer_filename, oldAfterFilename: priorVersion.customer_filename, newFilename: replacementFilename, oldBeforeHash: priorContentSha256, oldAfterHash, newHash: replacementContentSha256, newCheckoutAssetVersionId: replacementVersion, newCheckoutOrderId: replacementOrderId }, replacementOrder);
    const resendRequestedAt = Date.now();
    await page.goto(fixture!.routes.merchantOrder);
    await page.getByRole("button", { name: /send fresh access link/i }).click();
    await expect(page.getByRole("status")).toContainText(/sent|queued/i, { timeout: 30_000 });
    const resendMessage = await getDeliveredAccessMessage(request, fixture!, fixture!.orderId, "merchant_resend", { sentAfterMs: resendRequestedAt - 5_000 });
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "merchant-resend", { kind: "resend", messageId: resendMessage.id, status: resendMessage.status, recipient: fixture!.customer.email, orderId: fixture!.orderId, accessUrlHash: resendMessage.accessUrlHash, sentAt: resendMessage.sentAt });
  });

  test("provider financial events produce exact customer UI state", async ({ page, request }) => {
    test.setTimeout(900_000);
    await page.request.post("/api/auth/signout").catch(() => undefined);
    await signIn(page, fixture!.customer.email, fixture!.customer.password);
    // Refunds are merchant-initiated in this product and provider-confirmed
    // by webhook; drive the real refund flow with a merchant session.
    const merchantContext = await page.context().browser()!.newContext();
    const merchantPage = await merchantContext.newPage();
    await signIn(merchantPage, fixture!.merchant.email, fixture!.merchant.password);
    const origin = new URL(fixture!.baseUrl).origin;
    for (const transition of ["partial", "full"] as const) {
      const subject = transition === "partial" ? fixture!.financialOrders.partialRefund : fixture!.financialOrders.fullRefund;
      const before = await acceptanceAction(request, fixture!, "observe", undefined, subject);
      const paymentIntentId = before.observation?.providerPayment?.id;
      if (typeof paymentIntentId !== "string") throw new Error("Refund fixture has no correlated Stripe PaymentIntent.");
      // A full refund can only happen once; on a rerun the provider refund
      // already exists, so verify and reuse it instead of fabricating a
      // second one.
      const existingFullRefund = transition === "full" && before.observation.order.refund_status === "full"
        ? before.observation.refunds.find((row) => row.status === "succeeded")
        : undefined;
      let refund: { id?: string; status?: string; amount?: number };
      if (existingFullRefund) {
        refund = await getStripeRefund(request, existingFullRefund.stripe_refund_id, paymentIntentId);
      } else {
        const created = await merchantPage.request.post("/api/orders/refunds", {
          headers: { origin },
          data: { orderId: subject, mode: transition, ...(transition === "partial" ? { amountCents: 1 } : {}), reasonKey: "customer_request" },
        });
        if (!created.ok()) throw new Error(`Merchant refund request failed with ${created.status()}.`);
        const requested = await created.json() as { refund?: { id?: string } };
        if (!requested.refund?.id) throw new Error("Merchant refund request returned no record.");
        const processedResponse = await merchantPage.request.patch(`/api/orders/refunds/${requested.refund.id}`, {
          headers: { origin },
          data: { action: "process" },
        });
        if (!processedResponse.ok()) throw new Error(`Merchant refund processing failed with ${processedResponse.status()}.`);
        const processedRecord = await processedResponse.json() as { refund?: { stripe_refund_id?: string | null } };
        if (!processedRecord.refund?.stripe_refund_id) throw new Error("Processed refund has no provider identity.");
        refund = await getStripeRefund(request, processedRecord.refund.stripe_refund_id, paymentIntentId);
      }
      // Wait for the provider webhook for THIS refund to land and correlate.
      const refundDeadline = Date.now() + 90_000;
      let refundRow: { stripe_refund_id: string; amount_cents: number; status: string; source_event_id: string } | undefined;
      let webhook: (typeof beforeTypes)["webhook"] | undefined;
      for (;;) {
        const processed = await acceptanceAction(request, fixture!, "observe", undefined, subject);
        refundRow = processed.observation.refunds.find((row) => row.stripe_refund_id === refund.id);
        webhook = processed.observation.webhookEvents.find((row) => row.stripe_event_id === refundRow?.source_event_id);
        if (refundRow && webhook?.processed_at) break;
        if (Date.now() > refundDeadline) throw new Error("Refund webhook did not produce correlated application state.");
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      await page.goto(`/order/${subject}`);
      if (transition === "partial") {
        await expect(page.getByText(/Opening this order creates a private 15-minute access session/).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /view download|download/i }).first()).toBeVisible();
      } else {
        await expect(page.getByText("Download access was removed after this order was fully refunded. Contact the store if you believe this is a mistake.")).toBeVisible();
        await expect(page.getByRole("button", { name: /view download|^download/i })).toHaveCount(0);
      }
      await expectNoSeriousAccessibilityViolations(page, `${transition} refund dynamic state`);
      await acceptanceAction(request, fixture!, "observe", undefined, subject, transition === "partial" ? "stripe-partial-refund" : "stripe-full-refund", { kind: "refund", refundId: refund.id, status: refund.status, amount: refund.amount, paymentIntentId, webhook: { eventId: webhook.stripe_event_id, type: webhook.event_type, signatureVerified: webhook.signature_verified, status: "processed", receivedAt: webhook.created_at, processedAt: webhook.processed_at, attempts: webhook.attempt_count } });
    }
    await merchantContext.close();
    for (const transition of ["opened", "won", "lost"] as const) {
      const subject = transition === "opened" ? fixture!.financialOrders.disputeOpened : transition === "lost" ? fixture!.financialOrders.disputeLost : fixture!.financialOrders.disputeWon;
      const before = await acceptanceAction(request, fixture!, "observe", undefined, subject);
      const paymentIntentId = before.observation?.providerPayment?.id;
      if (typeof paymentIntentId !== "string") throw new Error("Dispute fixture has no correlated Stripe PaymentIntent.");
      const dispute = await runSupportedStripeDisputeScenario(request, transition, paymentIntentId);
      const expectedDisputeStatus = transition === "opened" ? "needs_response" : transition;
      // The application records the newest processed dispute event as the
      // row's source; wait for that exact provider event to be processed.
      const disputeDeadline = Date.now() + 180_000;
      let webhook: (typeof beforeTypes)["webhook"] | undefined;
      for (;;) {
        const processed = await acceptanceAction(request, fixture!, "observe", undefined, subject);
        const disputeRow = processed.observation.disputes.find((row) => row.stripe_dispute_id === dispute.disputeId);
        webhook = processed.observation.webhookEvents.find((row) => row.stripe_event_id === disputeRow?.source_event_id);
        if (disputeRow?.status === expectedDisputeStatus && webhook?.processed_at && dispute.eventIds!.includes(disputeRow.source_event_id)) break;
        if (Date.now() > disputeDeadline) throw new Error("Dispute webhook did not produce correlated application state.");
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      await page.goto(`/order/${subject}`);
      if (transition === "opened") {
        await expect(page.getByText("Downloads are temporarily unavailable while a payment dispute is reviewed. Your download grants are preserved.")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole("button", { name: /view download|^download/i })).toHaveCount(0);
      } else if (transition === "won") {
        await expect(page.getByText(/Opening this order creates a private 15-minute access session/).first()).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole("button", { name: /view download|download/i }).first()).toBeVisible();
      } else {
        await expect(page.getByText("Download access was removed after the payment dispute was decided against this order. Contact the store if you believe this is a mistake.")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole("button", { name: /view download|^download/i })).toHaveCount(0);
      }
      await expectNoSeriousAccessibilityViolations(page, `${transition} dispute dynamic state`);
      await acceptanceAction(request, fixture!, "observe", undefined, subject, transition === "opened" ? "stripe-dispute-opened" : transition === "won" ? "stripe-dispute-won" : "stripe-dispute-lost", { kind: "dispute", disputeId: dispute.disputeId, chargeId: dispute.chargeId, paymentIntentId, outcome: transition, eventIds: dispute.eventIds, webhook: { eventId: webhook.stripe_event_id, type: webhook.event_type, signatureVerified: webhook.signature_verified, status: "processed", receivedAt: webhook.created_at, processedAt: webhook.processed_at, attempts: webhook.attempt_count } });
    }
  });

  test("failed delivery attempt is visible before UI resend completes the chronology", async ({ page, request }) => {
    test.setTimeout(300_000);
    await page.request.post("/api/auth/signout").catch(() => undefined);
    await signIn(page, fixture!.merchant.email, fixture!.merchant.password);
    await page.goto(fixture!.routes.merchantOrder);
    // The fixture order's first delivery attempt genuinely failed (worker
    // crash recovery) before the retry delivered; the merchant surface must
    // expose that failure history alongside the successful delivery.
    // The order detail opens in a flyout portalled outside <main>.
    await expect(page.getByText(/Attempt 1 · Failed/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Delivery succeeded/i).first()).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page, "delivery failure history state");
    const resendRequestedAt = Date.now();
    await page.getByRole("button", { name: /send fresh access link|resend|retry/i }).click();
    await expect(page.getByRole("status")).toContainText(/sent|queued/i, { timeout: 30_000 });
    await expectNoSeriousAccessibilityViolations(page, "delivery retry dynamic state");
    const resend = await getDeliveredAccessMessage(request, fixture!, fixture!.orderId, "merchant_resend", { sentAfterMs: resendRequestedAt - 5_000 });
    const observed = await acceptanceAction(request, fixture!, "observe");
    const persistedResend = observed.observation.notifications.find((notification) => notification.provider_message_id === resend.id && notification.status === "succeeded");
    if (!persistedResend?.sent_at) throw new Error("Delivery retry did not persist the exact successful Resend message.");
    await acceptanceAction(request, fixture!, "observe", undefined, fixture!.orderId, "delivery-retry", { kind: "delivery", jobId: observed.observation.deliveryJob.id, attempts: observed.observation.deliveryAttempts.map((attempt) => ({ attempt: attempt.attempt_number, status: attempt.status, startedAt: attempt.started_at, finishedAt: attempt.finished_at })), resendMessageId: resend.id, resendSentAt: persistedResend.sent_at });
  });
});
