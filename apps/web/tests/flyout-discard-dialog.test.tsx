/** @vitest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Flyout } from "@/components/ui/flyout";

function layerOf(element: Element | null | undefined) {
  const match = Array.from(element?.classList ?? []).find((name) => /^z-\[\d+\]$/.test(name));
  return match ? Number(match.slice(3, -1)) : null;
}

describe("flyout discard prompt", () => {
  test("renders above the sheet backdrop so its buttons stay clickable", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Flyout
        open
        onOpenChange={onOpenChange}
        title="Edit product"
        isDirty
        confirmDiscardOnClose
        discardTitle="Discard product changes?"
      >
        <p>body</p>
      </Flyout>,
    );

    await user.keyboard("{Escape}");

    const prompt = await screen.findByText("Discard product changes?");
    const dialog = prompt.closest("[role='dialog']");
    expect(dialog).not.toBeNull();

    // The sheet's own backdrop and panel sit at 80/81; anything below that is
    // covered by the backdrop, which then swallows the click.
    const dialogLayer = layerOf(dialog);
    expect(dialogLayer).not.toBeNull();
    expect(dialogLayer!).toBeGreaterThan(81);

    const overlays = Array.from(document.querySelectorAll("div.fixed.inset-0"))
      .map(layerOf)
      .filter((value): value is number => value !== null);
    const sheetBackdrop = Math.max(...overlays.filter((value) => value <= 81));
    const promptBackdrop = Math.max(...overlays);
    expect(promptBackdrop).toBeGreaterThan(sheetBackdrop);

    // And the prompt actually answers.
    await user.click(screen.getByRole("button", { name: /keep editing/i }));
    await waitFor(() => expect(screen.queryByText("Discard product changes?")).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
