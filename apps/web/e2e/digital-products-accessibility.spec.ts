import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./accessibility-helpers";
import { login } from "./helpers";

type AccessibilityFixture = {
  merchant: { email: string; password: string };
  customer: { email: string; password: string };
  routes: {
    catalogFiles: string;
    product: string;
    cart: string;
    checkoutReturn: string;
    download: string;
    recovery: string;
    customerOrder: string;
    merchantOrder: string;
  };
};

function fixture(): AccessibilityFixture | null {
  const fixturePath = process.env.MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE;
  if (!fixturePath || !fs.existsSync(fixturePath)) return null;
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
  return raw.accessibility as AccessibilityFixture | null;
}

const acceptance = fixture();
if (!acceptance && process.env.MYRIVO_DIGITAL_RELEASE_GATE === "true") {
  throw new Error("Digital release gate requires a validated accessibility fixture.");
}
test.skip(!acceptance, "Digital accessibility acceptance requires a non-production seeded fixture.");

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
        if (await primaryAction.isVisible().catch(() => false)) await primaryAction.scrollIntoViewIfNeeded();
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
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus-visible")).toBeVisible();
      await expect(page.locator("[role=status], [role=alert], [aria-live]").first()).toBeAttached();
      const controls = page.locator("input, button, a[href]");
      const count = await controls.count();
      for (let index = 0; index < Math.min(count, 8); index += 1) {
        const control = controls.nth(index);
        if (await control.isVisible()) {
          const name = await control.getAttribute("aria-label") ?? await control.textContent() ?? await control.getAttribute("name");
          expect(name?.trim()).toBeTruthy();
        }
      }
      const animated = page.locator(".animate-spin");
      for (let index = 0; index < await animated.count(); index += 1) {
        expect(await animated.nth(index).evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
      }
    });
  });
}
