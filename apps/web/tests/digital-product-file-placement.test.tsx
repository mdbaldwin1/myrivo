/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProductManager, type ProductListItem } from "@/components/dashboard/product-manager";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";
const VARIANT_ID = "20000000-0000-4000-8000-000000000001";
const NEW_VARIANT_ID = "20000000-0000-4000-8000-000000000002";

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

// The scope is the whole point of these tests, so the stand-in reports it.
vi.mock("@/components/dashboard/digital-product-files", () => ({
  DigitalProductFiles: ({ scope }: { scope?: { productVariantId: string | null } }) => (
    <div data-testid="files-manager">Customer downloads for {scope?.productVariantId ?? "product"}</div>
  ),
}));

vi.mock("@/lib/feedback/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function variant(overrides: Partial<ProductListItem["product_variants"][number]> = {}) {
  return {
    id: VARIANT_ID,
    title: "Square",
    sku: "SUNRISE-1",
    sku_mode: "auto" as const,
    image_urls: [],
    group_image_urls: [],
    option_values: { Size: "Square" },
    price_cents: 1200,
    inventory_qty: 0,
    is_made_to_order: false,
    is_default: true,
    status: "active" as const,
    sort_order: 0,
    created_at: "2026-08-13T12:00:00.000Z",
    ...overrides,
  };
}

function product(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: PRODUCT_ID,
    title: "Sunrise printable",
    description: "A downloadable wall print.",
    slug: "sunrise-printable",
    sku: "SUNRISE",
    image_urls: [],
    image_alt_text: null,
    seo_title: null,
    seo_description: null,
    is_featured: false,
    price_cents: 1200,
    inventory_qty: 0,
    status: "draft",
    product_type: "digital",
    digital_rights_affirmed_at: null,
    created_at: "2026-08-13T12:00:00.000Z",
    digital_readiness: null,
    digital_preview: null,
    product_variants: [variant()],
    ...overrides,
  } as ProductListItem;
}

/** The editor's step carousel keeps every step mounted; only one pane is shown. */
function visible<T extends HTMLElement>(nodes: T[]): T {
  const shown = nodes.filter((node) => !node.closest(".hidden"));
  expect(shown).toHaveLength(1);
  return shown[0]!;
}

/** The editor's step carousel is the only visible pane; the others stay mounted. */
function visibleFileScopes() {
  return screen
    .queryAllByTestId("files-manager")
    .filter((node) => !node.closest(".hidden"))
    .map((node) => node.textContent?.replace("Customer downloads for ", "") ?? "");
}

function stubBrowserAnimation() {
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
}

describe("where customer downloads are provided", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    stubBrowserAnimation();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ products: [product()] }), { status: 200 })),
    );
  });

  test("follows the SKU down to whichever unit the buyer actually buys", async () => {
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product()]} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));

    // The product has variants, so the product itself is not what a buyer buys
    // and holds no files.
    expect(visibleFileScopes()).toEqual([]);

    await user.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);
    expect(visibleFileScopes()).toEqual([VARIANT_ID]);

    // Once the variant splits into options, the option is the sellable unit and
    // the variant stops carrying files - exactly where its SKU field goes.
    await user.click(screen.getByRole("checkbox", { name: /Has options/i }));
    expect(visibleFileScopes()).toEqual([]);
  });

  test("keeps a product without variants holding its own files", async () => {
    const single = product({ product_variants: [variant({ option_values: {} })] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ products: [single] }), { status: 200 })));
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[single]} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(visibleFileScopes()).toEqual(["product"]);
  });

  test("saves a brand-new variant in place rather than dead-ending on its files", async () => {
    const saved = product({
      product_variants: [variant(), variant({ id: NEW_VARIANT_ID, sku: "SUNRISE-2", title: "Variant 2", option_values: { Size: "Variant 2" }, is_default: false, sort_order: 1 })],
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ product: saved }), { status: 200 });
      }
      void input;
      return new Response(JSON.stringify({ products: [saved] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product()]} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Add variant" }));

    // A variant that does not exist yet cannot hold files, so the editor offers
    // the one action that changes that instead of telling the merchant to leave.
    expect(visibleFileScopes()).toEqual([]);
    expect(visible(screen.getAllByText(/Customer downloads attach to this variant once it is saved/i))).toBeTruthy();

    await user.click(visible(screen.getAllByRole("button", { name: "Save to add files" })));

    // The editor stays on this variant and the field it promised appears.
    await waitFor(() => expect(visibleFileScopes()).toEqual([NEW_VARIANT_ID]));
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")).toBe(true);
  });
});
