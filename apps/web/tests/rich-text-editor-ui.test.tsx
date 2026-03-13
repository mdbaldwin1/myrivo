/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

function getFirstByLabelText(label: string) {
  const match = screen.getAllByLabelText(label)[0];
  if (!match) {
    throw new Error(`Unable to find labeled element: ${label}`);
  }

  return match;
}

describe("RichTextEditor UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!HTMLElement.prototype.getClientRects) {
      Object.defineProperty(HTMLElement.prototype, "getClientRects", {
        configurable: true,
        value: () =>
          ({
            length: 1,
            item: () => null,
            [Symbol.iterator]: function* iterator() {
              yield { x: 0, y: 0, width: 100, height: 20, top: 0, right: 100, bottom: 20, left: 0 };
            }
          }) as DOMRectList
      });
    }
  });

  afterEach(() => {
    cleanup();
  });

  test("renders expanded formatting controls", () => {
    render(<RichTextEditor value="<p>Hello</p>" onChange={() => undefined} />);

    expect(getFirstByLabelText("Text style")).toBeTruthy();
    expect(getFirstByLabelText("Font family")).toBeTruthy();
    expect(getFirstByLabelText("Font size")).toBeTruthy();
    expect(getFirstByLabelText("Bold")).toBeTruthy();
    expect(getFirstByLabelText("Strikethrough")).toBeTruthy();
    expect(getFirstByLabelText("Superscript")).toBeTruthy();
    expect(getFirstByLabelText("Subscript")).toBeTruthy();
    expect(getFirstByLabelText("Align center")).toBeTruthy();
    expect(getFirstByLabelText("Increase indent")).toBeTruthy();
    expect(getFirstByLabelText("Text color")).toBeTruthy();
    expect(getFirstByLabelText("Insert image")).toBeTruthy();
    expect(screen.queryByLabelText("Quote block")).toBeNull();
  });

  test("opens the link editor popover", async () => {
    const user = userEvent.setup();

    render(<RichTextEditor value="<p>Hello</p>" onChange={() => undefined} />);
    await user.click(getFirstByLabelText("Link"));

    expect(screen.getByLabelText("Link URL")).toBeTruthy();
    expect(screen.getByText("Apply link")).toBeTruthy();
    expect(screen.getByText("Remove link")).toBeTruthy();
  });

  test("uploads and inserts an image", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        imageUrl: "https://cdn.example.com/rich-text/test.png"
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} imageUpload={{ folder: "email-studio" }} />);

    await user.click(getFirstByLabelText("Insert image"));
    const fileInput = screen.getByLabelText("Image file") as HTMLInputElement;
    const file = new File(["hello"], "hello.png", { type: "image/png" });
    await user.upload(fileInput, file);
    await user.type(screen.getByLabelText("Alt text"), "Uploaded example");
    await user.click(screen.getByText("Insert image", { selector: "button" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rich-text/images",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("https://cdn.example.com/rich-text/test.png"));
  });

  test("disables all toolbar controls when disabled", () => {
    render(<RichTextEditor value="<p>Hello</p>" onChange={() => undefined} disabled />);

    expect(getFirstByLabelText("Text style").hasAttribute("disabled")).toBe(true);
    expect(getFirstByLabelText("Font family").hasAttribute("disabled")).toBe(true);
    expect(getFirstByLabelText("Font size").hasAttribute("disabled")).toBe(true);
    expect(getFirstByLabelText("Bold").hasAttribute("disabled")).toBe(true);
    expect(getFirstByLabelText("Text color").hasAttribute("disabled")).toBe(true);
  });
});
