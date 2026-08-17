/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DigitalPreviewManager } from "@/components/dashboard/digital-preview-manager";
import { DigitalProductOverview } from "@/components/dashboard/digital-product-overview";
import { ProductManager, type ProductListItem } from "@/components/dashboard/product-manager";
import {
  variantOptionInstruction,
  variantOptionSummary,
} from "@/components/dashboard/product-manager-domain";
import { enrichDigitalCatalogProducts } from "@/lib/digital-products/catalog-state";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";
const VARIANT_ID = "20000000-0000-4000-8000-000000000001";

const filesMockState = vi.hoisted(() => ({
  signals: [] as AbortSignal[],
  refreshes: [] as Promise<void>[],
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, fill, unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    void fill;
    void unoptimized;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt ?? ""} src={typeof src === "string" ? src : ""} {...props} />
    );
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/stores/studio/catalog",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/rich-text-editor", () => ({
  RichTextEditor: ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) => (
    <textarea aria-label="Description" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("@/components/dashboard/digital-product-files", () => ({
  DigitalProductFiles: ({
    productId,
    onCatalogChange,
  }: {
    productId: string;
    onCatalogChange?: (signal?: AbortSignal) => void | Promise<void>;
  }) => {
    const controllerRef = React.useRef<AbortController | null>(null);
    if (!controllerRef.current) controllerRef.current = new AbortController();
    React.useEffect(() => {
      const controller = controllerRef.current;
      return () => controller?.abort();
    }, []);
    return (
      <div>
        Files manager
        <button
          type="button"
          onClick={() => {
            const signal = controllerRef.current?.signal;
            if (signal) filesMockState.signals.push(signal);
            filesMockState.refreshes.push(Promise.resolve(onCatalogChange?.(signal)).then(() => undefined));
          }}
        >
          Refresh files catalog for {productId}
        </button>
      </div>
    );
  },
}));

vi.mock("@/lib/feedback/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function product(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: PRODUCT_ID,
    title: "Sunrise printable",
    description: "A downloadable wall print.",
    slug: "sunrise-printable",
    sku: "SUNRISE",
    image_urls: ["https://project.supabase.co/storage/v1/object/public/store-products/store-1/products/sunrise.jpg"],
    image_alt_text: "Sunrise artwork",
    seo_title: null,
    seo_description: null,
    is_featured: false,
    price_cents: 1200,
    inventory_qty: 0,
    status: "draft",
    product_type: "digital",
    digital_rights_affirmed_at: null,
    created_at: "2026-08-13T12:00:00.000Z",
    digital_readiness: {
      ready: false,
      reasons: ["rights_missing", "preview_not_ready", `variant_missing_file:${VARIANT_ID}`],
      applicableFileCount: 1,
      previewStatus: "processing",
    },
    digital_preview: {
      status: "processing",
      sourceAssetVersionId: null,
      publicUrl: null,
      isMerchantOverride: false,
      failureReason: null,
    },
    product_variants: [
      {
        id: VARIANT_ID,
        title: "Square",
        sku: "SUNRISE-SQUARE",
        sku_mode: "auto",
        image_urls: [],
        group_image_urls: [],
        option_values: { Size: "Square" },
        price_cents: 1200,
        inventory_qty: 0,
        is_made_to_order: false,
        is_default: true,
        status: "active",
        sort_order: 0,
        created_at: "2026-08-13T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("digital catalog overview and media", () => {
  afterEach(() => cleanup());

  test("summarizes delivery policy and gives every publish blocker an exact repair action", async () => {
    const onNavigate = vi.fn();
    const onEdit = vi.fn();
    const onPublish = vi.fn();
    const user = userEvent.setup();

    render(
      <DigitalProductOverview
        product={product()}
        onNavigate={onNavigate}
        onEdit={onEdit}
        onPublish={onPublish}
      />,
    );

    expect(screen.getByText("Digital download")).toBeTruthy();
    expect(screen.getByText("$12.00")).toBeTruthy();
    expect(screen.getByText("1 applicable file")).toBeTruthy();
    expect(screen.getByText("Preview processing")).toBeTruthy();
    expect(screen.getByText(/48-hour access links/i)).toBeTruthy();
    expect(screen.getByText(/5 downloads per purchased file/i)).toBeTruthy();
    expect(screen.getByText(/personal-use license/i)).toBeTruthy();

    const readiness = screen.getByRole("region", { name: "Publishing readiness" });
    expect(within(readiness).getByText("3 steps remaining")).toBeTruthy();
    await user.click(within(readiness).getByRole("button", { name: "Confirm distribution rights" }));
    expect(onEdit).toHaveBeenCalledWith("rights");
    await user.click(within(readiness).getByRole("button", { name: "Finish storefront preview" }));
    expect(onNavigate).toHaveBeenCalledWith("media", "preview");
    await user.click(within(readiness).getByRole("button", { name: "Attach a file to Square" }));
    // Files are provided beside the SKU for the unit that owns them, so this
    // blocker opens the product editor at that variant rather than a tab.
    expect(onNavigate).toHaveBeenCalledWith("editor", VARIANT_ID);
    expect(within(readiness).getByRole("button", { name: "Publish product" }).hasAttribute("disabled")).toBe(true);
  });

  test("separates storefront images from private deliverables and selects an exact public preview override", async () => {
    const publicUrl = "https://project.supabase.co/storage/v1/object/public/store-products/store-1/products/sunrise.jpg";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ publicUrl: "https://cdn.example/watermarked-sunrise.jpg" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <DigitalPreviewManager
        productId={PRODUCT_ID}
        productTitle="Sunrise printable"
        storefrontImages={[publicUrl]}
        preview={{
          status: "missing",
          sourceAssetVersionId: null,
          publicUrl: null,
          isMerchantOverride: false,
          failureReason: null,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Storefront images" })).toBeTruthy();
    expect(screen.getByText(/public product photography/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Customer deliverables" })).toBeTruthy();
    expect(screen.getByText(/managed privately in Files/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Buyer preview" })).toBeTruthy();
    expect(screen.getByText(/No public preview is ready/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use as buyer preview" }));
    expect(await screen.findByAltText("Public preview buyers see for Sunrise printable")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/products/digital-preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "override", productId: PRODUCT_ID, sourceUrl: publicUrl }),
      }),
    );
  });

  test("retries a failed automatic preview through the existing preview lifecycle", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ publicUrl: "https://cdn.example/recovered-preview.jpg" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalPreviewManager
      productId={PRODUCT_ID}
      productTitle="Sunrise printable"
      storefrontImages={[]}
      preview={{
        status: "failed",
        sourceAssetVersionId: "40000000-0000-4000-8000-000000000002",
        publicUrl: null,
        isMerchantOverride: false,
        failureReason: "Preview processing failed",
      }}
    />);

    await user.click(screen.getByRole("button", { name: "Retry automatic preview" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/products/digital-preview", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ mode: "asset", productId: PRODUCT_ID, sourceAssetVersionId: "40000000-0000-4000-8000-000000000002" }),
    }));
    expect(await screen.findByAltText("Public preview buyers see for Sunrise printable")).toBeTruthy();
  });

  test("ignores a preview response that completes after the selected product changes", async () => {
    let releasePreview!: () => void;
    const previewReleased = new Promise<void>((resolve) => { releasePreview = resolve; });
    const onChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => {
      await previewReleased;
      return new Response(JSON.stringify({ publicUrl: "https://cdn.example/product-a-preview.jpg" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const user = userEvent.setup();
    const { rerender } = render(
      <DigitalPreviewManager
        productId={PRODUCT_ID}
        productTitle="Product A"
        storefrontImages={["https://cdn.example/product-a.jpg"]}
        preview={null}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Use as buyer preview" }));
    rerender(
      <DigitalPreviewManager
        productId="10000000-0000-4000-8000-000000000099"
        productTitle="Product B"
        storefrontImages={[]}
        preview={null}
        onChange={onChange}
      />,
    );
    releasePreview();

    expect(await screen.findByText("No public preview is ready")).toBeTruthy();
    expect(screen.queryByAltText("Public preview buyers see for Product B")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("fulfillment-aware variant copy", () => {
  test("never describes stock for digital two-tier create and edit summaries", () => {
    expect(variantOptionInstruction("digital")).toBe(
      "Add options for this variant, then configure price, SKU, and images for each option.",
    );
    expect(variantOptionSummary("digital", {
      priceDollars: "12.00",
      inventoryQty: "0",
      status: "active",
    })).toBe("$12.00 · active");
    expect(variantOptionInstruction("physical")).toContain("inventory");
    expect(variantOptionSummary("physical", {
      priceDollars: "12.00",
      inventoryQty: "4",
      status: "active",
    })).toBe("$12.00 · Inv 4 · active");
  });
});

describe("digital catalog server state", () => {
  test("loads readiness and exposes only the public preview URL", async () => {
    const privatePreviewPath = `store-1/${PRODUCT_ID}/watermarked.jpg`;
    const from = vi.fn((table: string) => {
      let selection = "";
      const query = {
        select(value: string) { selection = value; return query; },
        eq() { return query; },
        in() { return query; },
        single: async () => ({ data: { product_type: "digital", digital_rights_affirmed_at: "2026-08-13T12:00:00.000Z" }, error: null }),
        maybeSingle: async () => ({ data: { status: "ready" }, error: null }),
        returns: async () => {
          if (table === "product_variants") return { data: [{ id: VARIANT_ID, status: "active" }], error: null };
          if (table === "digital_product_assets") {
            return { data: [{ id: "asset-1", product_variant_id: VARIANT_ID, active: true, digital_product_asset_versions: [{ id: "version-1", status: "ready", retired_at: null }] }], error: null };
          }
          if (table === "digital_product_previews" && selection.includes("public_preview_path")) {
            return { data: [{ product_id: PRODUCT_ID, status: "ready", source_asset_version_id: "version-1", public_preview_path: privatePreviewPath, is_merchant_override: false, failure_reason: null }], error: null };
          }
          return { data: [], error: null };
        },
      };
      return query;
    });
    const admin = {
      from,
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example/public-preview.jpg" } }) }) },
    };

    const [enriched] = await enrichDigitalCatalogProducts({
      admin: admin as never,
      storeId: "store-1",
      products: [{ id: PRODUCT_ID, product_type: "digital" as const }],
    });

    expect(enriched?.digital_readiness?.ready).toBe(true);
    expect(enriched?.digital_preview?.publicUrl).toBe("https://cdn.example/public-preview.jpg");
    expect(JSON.stringify(enriched)).not.toContain(privatePreviewPath);
  });
});

describe("ProductManager digital catalog integration", () => {
  beforeEach(() => {
    filesMockState.signals.length = 0;
    filesMockState.refreshes.length = 0;
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("is fulfillment-first and never exposes physical stock controls for a digital product", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ products: [product()] }), { status: 200 })));
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product()]} />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Fulfillment" })).toBeTruthy();
    expect(within(table).queryByRole("columnheader", { name: "Inventory" })).toBeNull();
    expect(within(table).getByText("Digital download")).toBeTruthy();
    expect(within(table).queryByRole("button", { name: /Adjust inventory/i })).toBeNull();

    const tabs = screen.getByRole("tablist", { name: "Product details" });
    // Files live beside the SKU in the product editor, not in their own tab.
    expect(within(tabs).queryByRole("tab", { name: "Files" })).toBeNull();
    expect(within(tabs).queryByRole("tab", { name: "Inventory" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText(/Files are attached after this draft is created/i)).toBeTruthy();
    expect(screen.queryByText("Enable made to order")).toBeNull();
    expect(screen.queryByText("Inventory")).toBeNull();
    expect(screen.getByRole("checkbox", { name: /I own or control the rights/i })).toBeTruthy();
  });

  test("keeps physical inventory controls unchanged", () => {
    const physical = product({
      title: "Framed print",
      product_type: "physical",
      inventory_qty: 8,
      digital_readiness: null,
      digital_preview: null,
      digital_rights_affirmed_at: null,
      product_variants: [{ ...product().product_variants[0]!, inventory_qty: 8 }],
    });
    render(<ProductManager initialProducts={[physical]} />);

    expect(screen.getByRole("tab", { name: "Inventory" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Files" })).toBeNull();
    expect(screen.getByRole("button", { name: "Adjust inventory for Framed print" })).toBeTruthy();
  });

  test("clears rights when fulfillment changes so conversion can never submit stale consent", async () => {
    const putBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/products" && init?.method === "PATCH") {
          putBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
          return new Response(JSON.stringify({ product: product({ product_type: "physical" }) }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ products: [product()] }), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product({ digital_rights_affirmed_at: "2026-08-13T12:00:00.000Z" })]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const fulfillment = screen.getByRole("combobox", { name: "Fulfillment" });
    await user.click(fulfillment);
    await user.click(screen.getByRole("option", { name: "Physical product" }));
    await user.click(fulfillment);
    await user.click(screen.getByRole("option", { name: "Digital download" }));

    expect(screen.getByRole("checkbox", { name: /I own or control the rights/i }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(putBodies[0]?.digitalRightsAffirmed).toBe(false);
  });

  test("refreshes authoritative readiness after rights are saved and uses it before publishing", async () => {
    const starting = product({
      digital_readiness: {
        ready: false,
        reasons: ["rights_missing"],
        applicableFileCount: 1,
        previewStatus: "ready",
      },
      digital_preview: {
        status: "ready",
        sourceAssetVersionId: null,
        publicUrl: "https://cdn.example/preview.jpg",
        isMerchantOverride: true,
        failureReason: null,
      },
    });
    const ready = product({
      digital_rights_affirmed_at: "2026-08-13T12:00:00.000Z",
      digital_readiness: {
        ready: true,
        reasons: [],
        applicableFileCount: 1,
        previewStatus: "ready",
      },
      digital_preview: starting.digital_preview,
    });
    let catalogReads = 0;
    const patchBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/products" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        patchBodies.push(body);
        return new Response(JSON.stringify({
          product: {
            ...starting,
            digital_rights_affirmed_at: ready.digital_rights_affirmed_at,
            status: body.status ?? starting.status,
          },
        }), { status: 200 });
      }
      catalogReads += 1;
      return new Response(JSON.stringify({ products: [ready] }), { status: 200 });
    }));
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[starting]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("checkbox", { name: /I own or control the rights/i }));
    await user.click(screen.getByRole("button", { name: "Save product" }));

    const readiness = await screen.findByRole("region", { name: "Publishing readiness" });
    expect(await within(readiness).findByText("Ready for your storefront")).toBeTruthy();
    await user.click(within(readiness).getByRole("button", { name: "Publish product" }));
    expect(catalogReads).toBeGreaterThanOrEqual(2);
    expect(patchBodies.some((body) => body.status === "active")).toBe(true);
  });

  test("refreshes readiness after a media mutation and refuses publish when the fresh catalog is blocked", async () => {
    const initiallyReady = product({
      digital_rights_affirmed_at: "2026-08-13T12:00:00.000Z",
      digital_readiness: { ready: true, reasons: [], applicableFileCount: 1, previewStatus: "ready" },
      digital_preview: {
        status: "ready",
        sourceAssetVersionId: null,
        publicUrl: "https://cdn.example/old-preview.jpg",
        isMerchantOverride: true,
        failureReason: null,
      },
    });
    const freshBlocked = product({
      digital_rights_affirmed_at: initiallyReady.digital_rights_affirmed_at,
      digital_readiness: {
        ready: false,
        reasons: [`variant_missing_file:${VARIANT_ID}`],
        applicableFileCount: 0,
        previewStatus: "ready",
      },
      digital_preview: {
        status: "ready",
        sourceAssetVersionId: null,
        publicUrl: "https://cdn.example/new-preview.jpg",
        isMerchantOverride: true,
        failureReason: null,
      },
    });
    const patchBodies: Array<Record<string, unknown>> = [];
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/products/digital-preview") {
        return new Response(JSON.stringify({ publicUrl: "https://cdn.example/new-preview.jpg" }), { status: 200 });
      }
      if (String(input) === "/api/products" && init?.method === "PATCH") {
        patchBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ product: initiallyReady }), { status: 200 });
      }
      reads += 1;
      return new Response(JSON.stringify({ products: [freshBlocked] }), { status: 200 });
    }));
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[initiallyReady]} />);

    await user.click(screen.getByRole("tab", { name: "Media" }));
    await user.click(screen.getByRole("button", { name: "Use as buyer preview" }));
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    const readiness = await screen.findByRole("region", { name: "Publishing readiness" });
    expect(await within(readiness).findByText("1 step remaining")).toBeTruthy();
    expect(within(readiness).getByRole("button", { name: "Publish product" }).hasAttribute("disabled")).toBe(true);
    expect(reads).toBeGreaterThanOrEqual(1);
    expect(patchBodies.some((body) => body.status === "active")).toBe(false);
  });

  test("does not apply a Files catalog refresh whose JSON body resolves after switching products", async () => {
    const productB = product({
      id: "10000000-0000-4000-8000-000000000099",
      title: "Product B",
      slug: "product-b",
      sku: "PRODUCT-B",
    });
    let resolveCatalogBody!: (value: { products: ProductListItem[] }) => void;
    const catalogBody = new Promise<{ products: ProductListItem[] }>((resolve) => {
      resolveCatalogBody = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: () => catalogBody,
    }) as Response));
    const user = userEvent.setup();
    // A single unstructured variant keeps the SKU - and therefore the files
    // manager - at the product level, which is what this test drives.
    const productA = product({
      product_variants: [{ ...product().product_variants[0]!, option_values: {} }],
    });
    render(<ProductManager initialProducts={[productA, productB]} />);

    // The files manager now lives in the product editor beside the SKU.
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: `Refresh files catalog for ${PRODUCT_ID}` }));
    await waitFor(() => expect(filesMockState.signals).toHaveLength(1));
    expect(filesMockState.signals[0]?.aborted).toBe(false);

    // The editor is modal, so leaving it is how a merchant reaches another
    // product; that unmount is what must abort the in-flight refresh.
    await user.keyboard("{Escape}");
    await user.click(screen.getByText("Product B"));
    await waitFor(() => expect(filesMockState.signals[0]?.aborted).toBe(true));

    await act(async () => {
      resolveCatalogBody({ products: [product({ title: "Stale product A" })] });
      await filesMockState.refreshes[0];
    });

    expect(screen.getByRole("heading", { level: 3, name: "Product B" })).toBeTruthy();
    expect(screen.queryByText("Stale product A")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("aborts a Media catalog refresh before a deferred JSON body can overwrite another product", async () => {
    const productB = product({
      id: "10000000-0000-4000-8000-000000000099",
      title: "Product B",
      slug: "product-b",
      sku: "PRODUCT-B",
    });
    let resolveCatalogBody!: (value: { products: ProductListItem[] }) => void;
    let resolveCatalogBodyRead!: () => void;
    const catalogBodyRead = new Promise<void>((resolve) => {
      resolveCatalogBodyRead = resolve;
    });
    const catalogBody = new Promise<{ products: ProductListItem[] }>((resolve) => {
      resolveCatalogBody = resolve;
    });
    let catalogSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/products/digital-preview") {
        return new Response(JSON.stringify({ publicUrl: "https://cdn.example/new-preview.jpg" }), { status: 200 });
      }
      catalogSignal = init?.signal ?? undefined;
      return {
        ok: true,
        json: async () => {
          const payload = await catalogBody;
          resolveCatalogBodyRead();
          return payload;
        },
      } as Response;
    }));
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product(), productB]} />);

    await user.click(screen.getByRole("tab", { name: "Media" }));
    await user.click(screen.getByRole("button", { name: "Use as buyer preview" }));
    await waitFor(() => expect(catalogSignal).toBeDefined());

    await user.click(screen.getByText("Product B"));
    await act(async () => {
      resolveCatalogBody({ products: [product({ title: "Stale product A" })] });
      await catalogBodyRead;
    });

    expect(catalogSignal?.aborted).toBe(true);
    expect(screen.getByRole("heading", { level: 3, name: "Product B" })).toBeTruthy();
    expect(screen.queryByText("Stale product A")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  test("explains on the image field that buyers only ever see a watermarked version", async () => {
    const user = userEvent.setup();
    render(<ProductManager initialProducts={[product()]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const guidance = screen.getByText(/Buyers only ever see a watermarked version/i);
    expect(guidance.textContent).toMatch(/generated from the file automatically/i);
    expect(guidance.textContent).toMatch(/watermarked before the storefront shows it/i);

    // Rendered as the field's description, so assistive technology announces it
    // with the control rather than as loose text nearby.
    expect(guidance.getAttribute("id")).toMatch(/-description$/);
  });

  test("does not claim watermarking on a physical product's image field", () => {
    render(<ProductManager initialProducts={[product({ product_type: "physical", digital_readiness: null, digital_preview: null, digital_rights_affirmed_at: null })]} />);
    expect(screen.queryByText(/Buyers only ever see a watermarked version/i)).toBeNull();
  });
});
