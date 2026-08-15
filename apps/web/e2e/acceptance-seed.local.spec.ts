/**
 * LOCAL ONLY — acceptance seeding for the digital-products release gate.
 * Not committed. Publishes the draft digital product through the merchant UI
 * and completes six real Stripe test checkouts, recording order UUIDs.
 */
import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { deflateSync } from "node:zlib";


const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SCRATCH = "/private/tmp/claude-501/-Users-michaelbaldwin-Myrivo-myrivo/f27af79c-6414-4b07-9b34-6ed849c6d86c/scratchpad/acceptance";
const STATE_PATH = `${SCRATCH}/seed-state.json`;
const MERCHANT = { email: "delivered+acceptance-merchant@resend.dev", password: "acceptance-merchant-passphrase-1" };
const CUSTOMER_EMAIL = "delivered@resend.dev";
const PRODUCT_URL = "/s/test-store/products/acceptance-digital-print";
const CART_URL = "/s/test-store/cart";
const PRODUCT_ID = "cb4bd887-29dd-43c2-a09d-672904a1ae84";

type SeedState = { published?: boolean; orders: Record<string, string> };

function loadState(): SeedState {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as SeedState; } catch { return { orders: {} }; }
}
function saveState(state: SeedState) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
function psql(sql: string): string {
  return execSync(`psql "${DB}" -t -A -c ${JSON.stringify(sql)}`, { encoding: "utf8" }).trim();
}

// --- minimal valid PNG generator (truecolor, solid fill) ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function makePng(width: number, height: number, rgb: [number, number, number], noiseSeed = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const px = rowStart + 1 + x * 3;
      raw[px] = (rgb[0] + ((x * 7 + y * 13 + noiseSeed) % 23)) & 0xff;
      raw[px + 1] = rgb[1];
      raw[px + 2] = rgb[2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function seedLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  const essential = page.getByRole("button", { name: /essential only/i });
  if (await essential.isVisible().catch(() => false)) await essential.click();
  await page.getByPlaceholder("owner@yourshop.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const legal = page.getByRole("checkbox", { name: /i have read and accept the required legal updates/i });
  if (await legal.isVisible().catch(() => false)) {
    await legal.check();
    await page.getByRole("button", { name: /accept and continue/i }).click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  await expect(page).toHaveURL(/\/(dashboard|onboarding|account)/, { timeout: 20_000 });
}

async function dismissOverlays(page: Page) {
  const essential = page.getByRole("button", { name: /essential only/i });
  if (await essential.isVisible().catch(() => false)) await essential.click();
  const close = page.getByRole("button", { name: /^close$|dismiss/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click().catch(() => undefined);
}

async function fillStripeAndPay(page: Page) {
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  const email = page.locator('input[name="email"]');
  if (await email.isVisible().catch(() => false)) {
    if (!(await email.inputValue().catch(() => ""))) await email.fill(CUSTOMER_EMAIL);
  }
  const cardNumber = page.locator('input[name="cardNumber"]');
  const cardRadio = page.locator("#payment-method-accordion-item-title-card");
  await cardRadio.waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(2500); // let the hosted page finish hydrating
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await cardNumber.isVisible().catch(() => false)) break;
    await cardRadio.check({ force: true }).catch(() => undefined);
    await cardNumber.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  }
  await cardNumber.waitFor({ state: "visible", timeout: 5_000 });
  console.log("[seed] card accordion open");
  for (const checkbox of await page.locator('input[type="checkbox"]').all()) {
    if (await checkbox.isChecked().catch(() => false)) await checkbox.uncheck({ force: true }).catch(() => undefined);
  }
  await page.locator('input[name="cardNumber"]').fill(currentCard);
  await page.locator('input[name="cardExpiry"]').fill("12 / 34");
  await page.locator('input[name="cardCvc"]').fill("123");
  const name = page.locator('input[name="billingName"]');
  if (await name.isVisible().catch(() => false)) await name.fill("Accept Buyer");
  const zip = page.locator('input[name="billingPostalCode"]');
  if (await zip.isVisible().catch(() => false)) await zip.fill("12345");
  const pay = page.locator('button[type="submit"], .SubmitButton').first();
  await pay.click();
}

let currentCard = "4242424242424242";

async function resendHasOrderEmail(orderId: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  const list = await fetch("https://api.resend.com/emails?limit=50", { headers: { authorization: `Bearer ${key}` } });
  if (!list.ok) return false;
  const rows = ((await list.json()) as { data?: Array<{ id: string; to: string[]; subject: string }> }).data ?? [];
  for (const row of rows.filter((r) => r.to.includes(CUSTOMER_EMAIL)).slice(0, 10)) {
    const detail = await fetch(`https://api.resend.com/emails/${row.id}`, { headers: { authorization: `Bearer ${key}` } });
    if (!detail.ok) continue;
    const message = (await detail.json()) as { html?: string; text?: string; subject?: string };
    if (`${message.subject}\n${message.html}\n${message.text}`.includes(orderId)) return true;
  }
  return false;
}

function workerPid(): string {
  return execSync("pgrep -f delivery-worker-loop.sh | head -1", { encoding: "utf8" }).trim();
}

async function completePurchase(context: BrowserContext, key: string, card: string, state: SeedState) {
  currentCard = card;
  const page = await context.newPage();
  await page.goto(PRODUCT_URL);
  await dismissOverlays(page);
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto(CART_URL);
  await dismissOverlays(page);
  await page.getByPlaceholder("First name").fill("Accept");
  await page.getByPlaceholder("Last name").fill("Buyer");
  await page.getByPlaceholder("you@example.com").fill(CUSTOMER_EMAIL);
  await page.getByRole("checkbox", { name: /immediate digital delivery/i }).check();

  const isMain = key === "main";
  let pid = "";
  if (isMain) {
    pid = workerPid();
    if (!pid) throw new Error("delivery worker loop not found");
    execSync(`kill -STOP ${pid}`);
    await page.waitForTimeout(4000); // let any in-flight tick drain
  }
  try {
    await page.getByRole("button", { name: /^checkout$/i }).click();
    await fillStripeAndPay(page);
    await expect(page).toHaveURL(/127\.0\.0\.1:3000\/s\/test-store\/checkout/, { timeout: 90_000 });
    await expect(page.locator("main").first()).toContainText(/Order [0-9a-f-]{36} placed successfully/i, { timeout: 120_000 });
    const text = await page.locator("main").first().innerText();
    const orderId = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
    if (!orderId) throw new Error("no order id on confirmation page");
    console.log(`[seed] ${key} order: ${orderId}`);

    if (isMain) {
      // Simulate a worker crash on the first delivery attempt: claim the job
      // with a 1-second lease via the production claim RPC, then let the
      // resumed worker recover it (attempt 1 fails via lease expiry, attempt 2
      // delivers). This produces a genuine failed->succeeded chronology.
      const claimed = psql("select order_id from claim_digital_delivery_job(1, 8)");
      if (!claimed.includes(orderId)) throw new Error(`claimed unexpected job: ${claimed || "none"}`);
      await page.waitForTimeout(2000); // lease expires
    }

    return orderId;
  } finally {
    if (isMain && pid) execSync(`kill -CONT ${pid}`);
  }
}

test.describe.serial("acceptance seeding", () => {
  test("merchant publishes the digital product through the catalog UI", async ({ page }) => {
    const state = loadState();
    test.skip(Boolean(state.published), "already published");
    await seedLogin(page, MERCHANT.email, MERCHANT.password);
    await page.goto("/dashboard/stores/test-store/catalog");
    await page.keyboard.press("Escape");
    await page
      .getByRole("row", { name: /Acceptance Digital Print/i })
      .getByText("Acceptance Digital Print", { exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Acceptance Digital Print" })).toBeVisible();
    await page.getByRole("tab", { name: "Files" }).click();
    await page.getByLabel("Add customer download files").setInputFiles({
      name: "acceptance-print-v1.png",
      mimeType: "image/png",
      buffer: makePng(96, 96, [200, 30, 30], 1),
    });
    await expect(page.getByText("Customer file is ready.").first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("tab", { name: "Overview" }).click();
    const rights = page.getByRole("button", { name: "Confirm distribution rights" }).first();
    if (await rights.isVisible().catch(() => false)) {
      await rights.click();
      const checkbox = page.locator("#edit-digital-rights");
      await checkbox.check();
      await page.getByRole("button", { name: /save product/i }).click();
      await expect(page.locator("#edit-digital-rights")).toBeHidden({ timeout: 20_000 });
    }
    await expect(page.getByText("Ready for your storefront")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Publish product" }).click();
    await expect(page.getByRole("button", { name: "Published" })).toBeVisible({ timeout: 30_000 });
    expect(psql(`select status from products where id='${PRODUCT_ID}'`)).toBe("active");
    const next = loadState();
    next.published = true;
    saveState(next);
  });

  for (const [key, card] of [
    ["main", "4242424242424242"],
    ["partialRefund", "4242424242424242"],
    ["fullRefund", "4242424242424242"],
    ["disputeOpened", "4000000000000259"],
    ["disputeWon", "4000000000000259"],
    ["disputeLost", "4000000000000259"],
  ] as const) {
    test(`checkout ${key}`, async ({ browser }) => {
      test.setTimeout(360_000);
      const state = loadState();
      test.skip(Boolean(state.orders[key]), "already purchased");
      const context = await browser.newContext();
      try {
        const orderId = await completePurchase(context, key, card, state);
        const next = loadState();
        next.orders[key] = orderId;
        saveState(next);

        if (card !== "4000000000000259") {
          // wait for delivery job success + provider-confirmed purchase email.
          // (Resend key is send-only; provider_message_id is persisted only
          // from a successful Resend send response.)
          await expect
            .poll(() => psql(`select status from digital_delivery_jobs where order_id='${orderId}' and job_type='purchase_delivery'`), { timeout: 120_000, intervals: [2000] })
            .toBe("succeeded");
          await expect
            .poll(() => psql(`select count(*) from digital_delivery_notifications where order_id='${orderId}' and notification_type='purchase' and status='succeeded' and provider='resend' and provider_message_id is not null and sent_at is not null`), { timeout: 120_000, intervals: [3000] })
            .toBe("1");
        } else {
          // Disputed-at-birth orders legitimately withhold the purchase email
          // while the dispute is open; require the job to exist instead.
          await expect
            .poll(() => psql(`select count(*) from digital_delivery_jobs where order_id='${orderId}' and job_type='purchase_delivery'`), { timeout: 120_000, intervals: [2000] })
            .toBe("1");
        }

        expect(Number(psql(`select count(*) from digital_order_entitlements where order_id='${orderId}'`))).toBe(1);

        if (key === "main") {
          const attempts = psql(`select attempt_number||':'||status from digital_delivery_attempts where order_id='${orderId}' order by attempt_number`);
          console.log(`[seed] main attempts: ${attempts.replace(/\n/g, ", ")}`);
          expect(attempts.split("\n")[0]).toBe("1:failed");
          expect(attempts.split("\n").at(-1)).toMatch(/succeeded$/);
        }
        if (card === "4000000000000259") {
          await expect
            .poll(() => psql(`select count(*) from order_disputes where order_id='${orderId}' and source_event_id is not null`), { timeout: 180_000, intervals: [3000] })
            .toBe("1");
          await expect
            .poll(() => psql(`select distinct status from digital_order_entitlements where order_id='${orderId}'`), { timeout: 60_000, intervals: [2000] })
            .toBe("suspended");
        }
      } finally {
        await context.close();
      }
    });
  }
});
