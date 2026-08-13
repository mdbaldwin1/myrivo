/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DigitalProductFiles, type DigitalProductAsset } from "@/components/dashboard/digital-product-files";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";
const VARIANT_ID = "20000000-0000-4000-8000-000000000001";
const ASSET_ONE = "30000000-0000-4000-8000-000000000001";
const ASSET_TWO = "30000000-0000-4000-8000-000000000002";

const notificationMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/feedback/toast", () => ({ notify: notificationMocks }));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readyAssets(): DigitalProductAsset[] {
  return [
    {
      id: ASSET_ONE,
      label: "Printable poster",
      product_variant_id: null,
      sort_order: 0,
      active: true,
      digital_product_asset_versions: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          customer_filename: "sunrise-poster.pdf",
          mime_type: "application/pdf",
          byte_size: 2_097_152,
          status: "ready",
          failure_reason: null,
          version_number: 2,
          created_at: "2026-08-13T12:00:00.000Z",
          retired_at: null,
        },
      ],
    },
    {
      id: ASSET_TWO,
      label: "Square artwork",
      product_variant_id: VARIANT_ID,
      sort_order: 1,
      active: true,
      digital_product_asset_versions: [
        {
          id: "40000000-0000-4000-8000-000000000002",
          customer_filename: "square-art.png",
          mime_type: "image/png",
          byte_size: 1_048_576,
          status: "failed",
          failure_reason: "Preview processing failed",
          version_number: 1,
          created_at: "2026-08-13T12:00:00.000Z",
          retired_at: null,
        },
      ],
    },
  ];
}

const variants = [
  {
    id: VARIANT_ID,
    label: "Square · 8 × 8",
    status: "active" as const,
  },
];

describe("DigitalProductFiles", () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.values(notificationMocks).forEach((mock) => mock.mockReset());
  });

  test("renders complete file metadata and uploads multiple files with independent announced progress", async () => {
    const completions: string[] = [];
    let releaseUploads!: () => void;
    const uploadsReleased = new Promise<void>((resolve) => {
      releaseUploads = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(`/api/products/digital-assets?productId=${PRODUCT_ID}`)) {
        return json({ assets: readyAssets() });
      }
      if (url === "/api/products/digital-assets/upload-url") {
        const body = JSON.parse(String(init?.body)) as { fileName: string };
        return json(
          {
            intentId: body.fileName.startsWith("first")
              ? "50000000-0000-4000-8000-000000000001"
              : "50000000-0000-4000-8000-000000000002",
            assetId: body.fileName.startsWith("first")
              ? "60000000-0000-4000-8000-000000000001"
              : "60000000-0000-4000-8000-000000000002",
            uploadUrl: `https://uploads.example/${body.fileName}`,
          },
          201,
        );
      }
      if (url.startsWith("https://uploads.example/")) {
        await uploadsReleased;
        return new Response(null, { status: 200 });
      }
      if (url === "/api/products/digital-assets/complete") {
        const body = JSON.parse(String(init?.body)) as { intentId: string };
        completions.push(body.intentId);
        return json({ assetId: body.intentId, versionId: body.intentId }, 201);
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalProductFiles productId={PRODUCT_ID} variants={variants} />);

    const list = await screen.findByRole("list", { name: "Customer download files" });
    const poster = within(list).getByRole("listitem", { name: "Printable poster" });
    expect(within(poster).getByText("sunrise-poster.pdf")).toBeTruthy();
    expect(within(poster).getByText("PDF · 2 MB · Version 2")).toBeTruthy();
    expect(within(poster).getByRole("combobox", { name: "File availability" })).toBeTruthy();
    expect(within(poster).getByText("Ready")).toBeTruthy();

    const failed = within(list).getByRole("listitem", { name: "Square artwork" });
    expect(within(failed).getByText("Square · 8 × 8")).toBeTruthy();
    expect(within(failed).getByText("Preview processing failed")).toBeTruthy();

    const first = new File(["first"], "first-print.pdf", { type: "application/pdf" });
    const second = new File(["second"], "second-print.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Add customer download files"), [first, second]);

    expect(await screen.findByRole("status", { name: "Upload progress for first-print.pdf" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Upload progress for second-print.png" })).toBeTruthy();
    releaseUploads();
    await waitFor(() => expect(completions).toHaveLength(2));
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Upload progress for first-print.pdf" })).toBeNull();
    });
    expect(notificationMocks.success).toHaveBeenCalledWith("2 customer files are ready.");
  });

  test("renames, assigns, rolls back a failed reorder, replaces, and removes safely", async () => {
    let assets = readyAssets();
    let reorderAttempts = 0;
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (url.startsWith(`/api/products/digital-assets?productId=${PRODUCT_ID}`)) {
        return json({ assets });
      }
      requests.push({ url, body });
      if (url === "/api/products/digital-assets" && init?.method === "PATCH") {
        if (body.action === "update" && body.label) {
          assets = assets.map((asset) =>
            asset.id === body.assetId ? { ...asset, label: String(body.label) } : asset,
          );
        }
        if (body.action === "update" && "productVariantId" in body) {
          assets = assets.map((asset) =>
            asset.id === body.assetId
              ? { ...asset, product_variant_id: (body.productVariantId as string | null) ?? null }
              : asset,
          );
        }
        return json({ updated: true });
      }
      if (url === "/api/products/digital-assets/reorder") {
        reorderAttempts += 1;
        return json({ error: "Another catalog update won. Try again." }, 409);
      }
      if (url === `/api/products/digital-assets/${ASSET_ONE}/replace`) {
        return json({
          intentId: "50000000-0000-4000-8000-000000000003",
          assetId: ASSET_ONE,
          uploadUrl: "https://uploads.example/replacement.pdf",
        }, 201);
      }
      if (url === "https://uploads.example/replacement.pdf") {
        return new Response(null, { status: 200 });
      }
      if (url === "/api/products/digital-assets/complete") {
        return json({ assetId: ASSET_ONE, versionNumber: 3 }, 201);
      }
      if (url === "/api/products/digital-assets" && init?.method === "DELETE") {
        assets = assets.filter((asset) => asset.id !== body.assetId);
        return json({ deactivated: true, entitlementCount: 2 });
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalProductFiles productId={PRODUCT_ID} variants={variants} />);
    const list = await screen.findByRole("list", { name: "Customer download files" });
    let poster = within(list).getByRole("listitem", { name: "Printable poster" });

    await user.click(within(poster).getByRole("button", { name: "Manage Printable poster" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const labelInput = within(poster).getByLabelText("Customer-facing label");
    await user.clear(labelInput);
    await user.type(labelInput, "Large printable poster");
    await user.click(within(poster).getByRole("button", { name: "Save label" }));
    expect(await within(list).findByRole("listitem", { name: "Large printable poster" })).toBeTruthy();

    poster = within(list).getByRole("listitem", { name: "Large printable poster" });
    await user.click(within(poster).getByRole("combobox", { name: "File availability" }));
    await user.click(screen.getByRole("option", { name: "Square · 8 × 8" }));
    await waitFor(() => {
      expect(requests).toContainEqual({
        url: "/api/products/digital-assets",
        body: { action: "update", assetId: ASSET_ONE, productVariantId: VARIANT_ID },
      });
    });

    await user.click(within(poster).getByRole("button", { name: "Move Large printable poster down" }));
    expect(reorderAttempts).toBe(1);
    await waitFor(() => {
      const names = within(list).getAllByRole("listitem").map((item) => item.getAttribute("aria-label"));
      expect(names).toEqual(["Large printable poster", "Square artwork"]);
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("could not be reordered");
    await waitFor(() => expect(document.activeElement).toBe(alert));

    await user.upload(
      within(poster).getByLabelText("Choose a replacement for Large printable poster"),
      new File(["replacement"], "replacement.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByRole("dialog", { name: "Replace Large printable poster?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Replace file" }));
    await waitFor(() => {
      expect(requests.some((request) => request.url.endsWith(`/${ASSET_ONE}/replace`))).toBe(true);
    });

    await user.click(within(poster).getByRole("button", { name: "Manage Large printable poster" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove file" }));
    const removeDialog = await screen.findByRole("dialog", { name: "Remove Large printable poster?" });
    expect(removeDialog.textContent).toContain("Existing customers keep access to versions they purchased");
    await user.click(screen.getByRole("button", { name: "Remove file" }));
    await waitFor(() => {
      expect(within(list).queryByRole("listitem", { name: "Large printable poster" })).toBeNull();
    });
    expect(notificationMocks.success).toHaveBeenCalledWith("Customer file removed. Existing purchases are preserved.");
  });

  test("retries a failed upload through its lifecycle intent", async () => {
    let directAttempts = 0;
    let completed = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(`/api/products/digital-assets?productId=${PRODUCT_ID}`)) {
        return json({ assets: completed ? readyAssets().slice(0, 1) : [] });
      }
      if (url === "/api/products/digital-assets/upload-url") {
        return json({ intentId: "50000000-0000-4000-8000-000000000004", assetId: ASSET_ONE, uploadUrl: "https://uploads.example/retry.pdf" }, 201);
      }
      if (url === "https://uploads.example/retry.pdf") {
        directAttempts += 1;
        return new Response(null, { status: directAttempts === 1 ? 503 : 200 });
      }
      if (url === "/api/products/digital-assets" && init?.method === "PATCH") {
        expect(JSON.parse(String(init.body))).toEqual({ action: "retry", intentId: "50000000-0000-4000-8000-000000000004" });
        return json({ intentId: "50000000-0000-4000-8000-000000000004", assetId: ASSET_ONE, uploadUrl: "https://uploads.example/retry.pdf" });
      }
      if (url === "/api/products/digital-assets/complete") {
        completed = true;
        return json({ assetId: ASSET_ONE, versionNumber: 1 }, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DigitalProductFiles productId={PRODUCT_ID} />);
    await screen.findByText("No customer files yet");

    await user.upload(screen.getByLabelText("Add customer download files"), new File(["retry"], "retry.pdf", { type: "application/pdf" }));
    const retry = await screen.findByRole("button", { name: "Retry upload" });
    await user.click(retry);

    await waitFor(() => expect(directAttempts).toBe(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry upload" })).toBeNull());
    expect(notificationMocks.success).toHaveBeenCalledWith("Customer file is ready.");
  });
});
