/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProductManager, type ProductListItem } from "@/components/dashboard/product-manager";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";

vi.mock("next/image", () => ({
  default: ({ alt, src }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ""} src={typeof src === "string" ? src : ""} />
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/stores/studio/catalog",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/rich-text-editor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Description" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("@/lib/feedback/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** The editor sheet paints its backdrop and panel at these layers. */
const SHEET_PANEL_LAYER = 81;

function layerOf(element: Element | null | undefined) {
  const match = Array.from(element?.classList ?? []).find((name) => /^z-\[\d+\]$/.test(name));
  return match ? Number(match.slice(3, -1)) : null;
}

function product(): ProductListItem {
  return {
    id: PRODUCT_ID,
    title: "Sunrise printable",
    description: "A wall print.",
    slug: "sunrise-printable",
    sku: "SUNRISE",
    image_urls: [],
    image_alt_text: null,
    seo_title: null,
    seo_description: null,
    is_featured: false,
    price_cents: 1200,
    inventory_qty: 4,
    status: "draft",
    product_type: "physical",
    digital_rights_affirmed_at: null,
    created_at: "2026-08-13T12:00:00.000Z",
    digital_readiness: null,
    digital_preview: null,
    product_variants: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        title: "Square",
        sku: "SUNRISE-1",
        sku_mode: "auto",
        image_urls: [],
        group_image_urls: [],
        option_values: { Size: "Square" },
        price_cents: 1200,
        inventory_qty: 4,
        is_made_to_order: false,
        is_default: true,
        status: "active",
        sort_order: 0,
        created_at: "2026-08-13T12:00:00.000Z",
      },
    ],
  } as ProductListItem;
}

describe("prompts raised from inside the product editor", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    if (!Element.prototype.animate) {
      Element.prototype.animate = function animate() {
        return {
          finished: Promise.resolve(),
          cancel() {},
          finish() {},
          addEventListener() {},
          removeEventListener() {},
        } as unknown as Animation;
      };
    }
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ products: [product()], variantIds: [] }), { status: 200 })),
    );
  });

  test("puts the delete-variant confirmation above the sheet that raised it", async () => {
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product()]} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Manage Square" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const prompt = await screen.findByText(/Delete variant/i);
    const dialog = prompt.closest("[role='dialog']");
    expect(layerOf(dialog)).toBeGreaterThan(SHEET_PANEL_LAYER);

    const overlays = Array.from(document.querySelectorAll("div.fixed.inset-0"))
      .map(layerOf)
      .filter((value): value is number => value !== null);
    expect(Math.max(...overlays)).toBeGreaterThan(SHEET_PANEL_LAYER);

    // And it answers, rather than sitting under a backdrop that eats the click.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/Delete variant/i)).toBeNull());
  });

  test("keeps every prompt raised from a sheet above that sheet", () => {
    // Four of these have shipped as bugs: a dialog rendered at the default
    // layer disappears under the sheet's backdrop, which then swallows every
    // click on it. Any component that owns a sheet must clear it.
    const sources = ["components/dashboard/product-manager.tsx", "components/ui/flyout.tsx"];
    const offenders: string[] = [];

    for (const relative of sources) {
      const source = readFileSync(path.join(process.cwd(), relative), "utf8");
      for (const match of source.matchAll(/DialogPrimitive\.(?:Overlay|Content)[^>]*?z-\[(\d+)\]/g)) {
        const layer = Number(match[1]);
        if (layer <= SHEET_PANEL_LAYER) offenders.push(`${relative}: z-[${layer}]`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
