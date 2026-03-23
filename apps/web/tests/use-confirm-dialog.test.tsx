/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";

function ConfirmDialogHarness({ onResolve }: { onResolve: (confirmed: boolean) => void }) {
  const { requestConfirm, confirmDialog } = useConfirmDialog();

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const confirmed = await requestConfirm({
            title: "Disconnect Stripe?",
            description: "This will reset the store payments setup.",
            confirmLabel: "Disconnect",
            confirmVariant: "destructive"
          });
          onResolve(confirmed);
        }}
      >
        Open confirm
      </button>
      {confirmDialog}
    </>
  );
}

describe("useConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  test("resolves true when the confirm action is clicked", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    render(<ConfirmDialogHarness onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: "Open confirm" }));

    expect(screen.getByText("Disconnect Stripe?")).toBeTruthy();
    expect(screen.getByText("This will reset the store payments setup.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(onResolve).toHaveBeenCalledWith(true);
  });

  test("resolves false when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    render(<ConfirmDialogHarness onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onResolve).toHaveBeenCalledWith(false);
  });
});
