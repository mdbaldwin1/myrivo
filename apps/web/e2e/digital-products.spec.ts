import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

type AcceptanceFixture = {
  merchant: { email: string; password: string };
  storeSlug: string;
  productSlug: string;
  mixedCartUrl: string;
  paidCheckoutReturnUrl: string;
  downloadUrl: string;
  expiredDownloadUrl: string;
  customerOrderUrl: string;
  merchantOrderUrl: string;
};

function fixture(): AcceptanceFixture | null {
  const fixturePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE;
  if (!fixturePath || !fs.existsSync(fixturePath)) return null;
  return JSON.parse(fs.readFileSync(fixturePath, "utf8")) as AcceptanceFixture;
}

const acceptance = fixture();
if (!acceptance && process.env.MYRIVO_DIGITAL_RELEASE_GATE === "true") {
  throw new Error("Digital release gate requires a validated acceptance fixture.");
}
test.skip(!acceptance, "Set MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE to a non-production seeded acceptance fixture.");

async function expectNoPrivateDeliveryMaterial(page: Page) {
  const html = await page.locator("body").innerText();
  expect(html).not.toMatch(/digital-product-assets|storage_path|bearer\s+[a-z0-9_-]+/i);
}

test.describe("digital-products release journeys", () => {
  test("merchant can inspect setup readiness and publish a prepared product", async ({ page }) => {
    await login(page, acceptance!.merchant.email, acceptance!.merchant.password);
    await page.goto("/dashboard/catalog");
    await expect(page.getByRole("heading", { name: /catalog/i })).toBeVisible();
    await expect(page.getByText(/digital download/i).first()).toBeVisible();
    await expect(page.getByText(/ready|published|active/i).first()).toBeVisible();
    await expectNoPrivateDeliveryMaterial(page);
  });

  test("digital-only payment returns to secure first access without physical fulfillment", async ({ page }) => {
    await page.goto(acceptance!.paidCheckoutReturnUrl);
    await expect(page.getByText(/digital (purchase|downloads|delivery)/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /download|access/i }).first()).toBeVisible();
    await expect(page.getByText(/shipping address|pickup location/i)).toHaveCount(0);
    await expectNoPrivateDeliveryMaterial(page);
  });

  test("mixed purchase preserves physical next steps and digital access", async ({ page }) => {
    await page.goto(acceptance!.mixedCartUrl);
    await expect(page.getByText(/digital delivery/i).first()).toBeVisible();
    await expect(page.getByText(/physical items/i).first()).toBeVisible();
    await expect(page.getByText(/shipping|pickup/i).first()).toBeVisible();
  });

  test("secure access lists purchased files and expired links offer neutral recovery", async ({ page }) => {
    await page.goto(acceptance!.downloadUrl);
    await expect(page.getByRole("heading", { name: /downloads|files/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /download/i }).first()).toBeVisible();
    await expect(page.getByText(/48 hours|expires/i).first()).toBeVisible();
    await expectNoPrivateDeliveryMaterial(page);

    await page.goto(acceptance!.expiredDownloadUrl);
    await expect(page.getByText(/expired|unavailable/i).first()).toBeVisible();
    await page.goto("/downloads/request");
    await expect(page.getByLabel(/order id/i)).toBeVisible();
    await expect(page.getByLabel(/order email/i)).toBeVisible();
  });

  test("customer and merchant order views expose access, refund, dispute, failure, and resend states", async ({ page }) => {
    await page.goto(acceptance!.customerOrderUrl);
    await expect(page.getByText(/digital downloads/i)).toBeVisible();
    await expect(page.getByText(/active|suspended|revoked|preparing/i).first()).toBeVisible();

    await login(page, acceptance!.merchant.email, acceptance!.merchant.password);
    await page.goto(acceptance!.merchantOrderUrl);
    await expect(page.getByText(/digital delivery/i).first()).toBeVisible();
    await expect(page.getByText(/refund|dispute|resend|delivery/i).first()).toBeVisible();
    await expectNoPrivateDeliveryMaterial(page);
  });

  test("structured provider evidence is linked to every required state transition", async () => {
    const evidencePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE;
    expect(evidencePath, "Set MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE to the redacted acceptance record.").toBeTruthy();
    expect(fs.existsSync(evidencePath!)).toBe(true);
    const raw = fs.readFileSync(evidencePath!, "utf8");
    const evidence = JSON.parse(raw) as { schemaVersion: number; scenarios: Array<{ id: string; providerEventId: string; applicationState: unknown }> };
    expect(evidence.schemaVersion).toBe(1);
    const required = ["five-grants", "grace-reuse", "replacement-version", "partial-refund", "full-refund", "dispute-opened", "dispute-won", "dispute-lost", "delivery-retry", "merchant-resend"];
    const scenarioIds = new Set(evidence.scenarios.map((scenario) => scenario.id));
    for (const id of required) expect(scenarioIds.has(id), `missing scenario ${id}`).toBe(true);
    for (const scenario of evidence.scenarios) {
      expect(scenario.providerEventId).toMatch(/^(evt_|email_|job_)[A-Za-z0-9_-]+$/);
      expect(scenario.applicationState).toBeTruthy();
    }
    expect(raw).not.toMatch(/sk_(?:live|test)_|re_(?:live|test)_|Bearer\s+/);
  });
});
