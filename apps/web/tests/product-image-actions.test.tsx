/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProductImageActions } from "@/components/dashboard/product-image-actions";

const notified = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/feedback/toast", () => ({ notify: notified }));

const ORIGINAL = "https://cdn.test/store/product/artwork.jpg";
const WATERMARKED = "https://cdn.test/store/product/watermarked-abc.jpg";

function setup(overrides: Partial<React.ComponentProps<typeof ProductImageActions>> = {}) {
  const props = {
    imageUrl: ORIGINAL,
    label: "product image 1",
    isFeatured: false,
    onFeature: vi.fn(),
    onWatermarked: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<ProductImageActions {...props} />);
  return props;
}

describe("what a merchant can do with a storefront image", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
      Element.prototype.setPointerCapture = () => {};
      Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  });

  test("watermarks the image in place so the artwork can safely be the shopfront", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      void _input;
      void init;
      return new Response(JSON.stringify({ publicUrl: WATERMARKED }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const props = setup();

    await userEvent.click(screen.getByRole("button", { name: "Manage product image 1" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Add watermark" }));

    await waitFor(() => expect(props.onWatermarked).toHaveBeenCalledWith(WATERMARKED));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ sourceUrl: ORIGINAL });
    // Nothing is committed until the product is saved, and the merchant is told.
    expect(notified.success).toHaveBeenCalledWith("Watermark added. Save the product to keep it.");
  });

  test("says why an image could not be watermarked instead of failing silently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "That image is unavailable." }), { status: 404 })),
    );
    const props = setup();

    await userEvent.click(screen.getByRole("button", { name: "Manage product image 1" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Add watermark" }));

    await waitFor(() => expect(notified.error).toHaveBeenCalledWith("That image is unavailable."));
    expect(props.onWatermarked).not.toHaveBeenCalled();
  });

  test("offers featuring and removal from the same menu", async () => {
    const props = setup();

    await userEvent.click(screen.getByRole("button", { name: "Manage product image 1" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Feature" }));
    expect(props.onFeature).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Manage product image 1" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalled();
  });

  test("marks the featured image and cannot feature it twice", async () => {
    setup({ isFeatured: true, label: "product image 1" });
    expect(screen.getByText("Featured image")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Manage product image 1" }));
    expect((await screen.findByRole("menuitem", { name: "Featured" })).getAttribute("aria-disabled")).toBe("true");
  });
});
