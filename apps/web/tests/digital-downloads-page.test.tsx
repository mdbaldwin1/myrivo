/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DigitalDownloadList } from "@/components/customer/digital-download-list";
import { DigitalOrderDownloads } from "@/components/customer/digital-order-downloads";
import DigitalDownloadRequestPage from "@/app/downloads/request/page";
import DigitalPersonalUseLicensePage from "@/app/legal/digital-personal-use-license/page";

const routerPush = vi.fn();
const TOKEN = "a".repeat(43);
const ORDER_ID = "40000000-0000-4000-8000-000000000501";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => routerPush(...args) }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function successfulListResponse(
  files: Array<Record<string, unknown>> = [
    {
      id: "80000000-0000-4000-8000-000000000501",
      label: "Printable wall art",
      customerFilename: "sunrise-print.pdf",
      mimeType: "application/pdf",
      byteSize: 2_097_152,
      status: "active",
      grantsRemaining: 4,
    },
  ],
) {
  return new Response(
    JSON.stringify({
      expiresAt: "2099-08-13T16:00:00.000Z",
      context: {
        store: {
          name: "Rachel's Prints",
          slug: "rachels-prints",
          policiesHref: "/s/rachels-prints/policies",
        },
        license: {
          version: "personal-use-v1",
          summary:
            "Personal printing and gifts only; no resale, sharing, or commercial use.",
          href: "/legal/digital-personal-use-license",
        },
      },
      files,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("active digital downloads page", () => {
  beforeEach(() => {
    routerPush.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("loads safe order/store context and renders a complete accessible file card", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => successfulListResponse()));

    render(<DigitalDownloadList />);

    expect(screen.getByRole("status").textContent).toContain(
      "Loading your files",
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Rachel's Prints" })).toBeTruthy();
    });
    expect(screen.queryByText(/Order #40000000/)).toBeNull();
    expect(screen.getByText("Printable wall art")).toBeTruthy();
    expect(screen.getByText("sunrise-print.pdf")).toBeTruthy();
    expect(screen.getByText("PDF · 2 MB")).toBeTruthy();
    expect(screen.getByText("4 of 5 downloads remaining")).toBeTruthy();
    expect(screen.getByText(/Personal printing and gifts only/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Read the personal-use license" }).getAttribute("href"),
    ).toBe("/legal/digital-personal-use-license");
    expect(screen.getByRole("button", { name: "Download Printable wall art" })).toBeTruthy();
  });

  test("shows suspended files without an actionable grant link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        successfulListResponse([
          {
            id: "80000000-0000-4000-8000-000000000502",
            label: "Disputed artwork",
            customerFilename: "art.png",
            mimeType: "image/png",
            byteSize: 1024,
            status: "suspended",
            grantsRemaining: 5,
          },
        ]),
      ),
    );

    render(<DigitalDownloadList />);

    await waitFor(() => {
      expect(screen.getByText("Temporarily unavailable")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: /Download Disputed artwork/i })).toBeNull();
    expect(screen.getByText(/contact the store if you need help/i)).toBeTruthy();
  });

  test("turns an expired or revoked link into a focused recovery path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "This access link is unavailable." }), {
          status: 410,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<DigitalDownloadList />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This download link is no longer available");
    expect(document.activeElement).toBe(alert);
    expect(
      screen.getByRole("link", { name: "Request a fresh link" }).getAttribute("href"),
    ).toBe("/downloads/request");
  });

  test("offers an in-place retry after a temporary list failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(successfulListResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalDownloadList />);
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByText("Printable wall art")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("scrubs a fragment immediately and retains its bearer only in memory for a transient exchange retry", async () => {
    window.history.replaceState(null, "", `/downloads#token=${TOKEN}`);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Temporary" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 201 }))
      .mockResolvedValueOnce(successfulListResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DigitalDownloadList />);
    expect(window.location.hash).toBe("");
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Rachel's Prints" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/digital-downloads/session", expect.objectContaining({
      method: "POST", body: JSON.stringify({ token: TOKEN }),
    }));
    expect(window.location.hash).toBe("");
  });
});

describe("digital personal-use license page", () => {
  test("publishes the complete versioned platform license in plain language", () => {
    render(<DigitalPersonalUseLicensePage />);

    expect(screen.getByRole("heading", { name: "Digital personal-use license" })).toBeTruthy();
    expect(screen.getByText(/Version personal-use-v1/i)).toBeTruthy();
    expect(screen.getByText(/reasonable number of copies/i)).toBeTruthy();
    expect(screen.getByText(/personal gifts/i)).toBeTruthy();
    expect(screen.getByText(/may not resell, redistribute, share, sublicense, upload/i)).toBeTruthy();
    expect(screen.getByText(/Copyright remains with the creator/i)).toBeTruthy();
    expect(screen.getByText(/non-exclusive, non-transferable license/i)).toBeTruthy();
  });
});

describe("digital access recovery page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("explains the 48-hour policy and validates fields inline", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalDownloadRequestPage />);

    expect(screen.getByText(/fresh link will work for 48 hours/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to view your orders" })).toBeTruthy();
    await user.type(screen.getByLabelText("Order ID"), "not-an-order");
    await user.type(screen.getByLabelText("Order email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Email me a fresh link" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter the full order ID and a valid email address.",
    );
    expect(screen.getByLabelText("Order ID").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("confirms the neutral result without revealing whether the order exists", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          message:
            "If the order details match, a fresh download link will arrive by email.",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalDownloadRequestPage />);
    await user.type(screen.getByLabelText("Order ID"), ORDER_ID);
    await user.type(screen.getByLabelText("Order email"), "Buyer@Example.COM");
    await user.click(screen.getByRole("button", { name: "Email me a fresh link" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Check your email");
    expect(status.textContent).toContain("If the order details match");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/digital-downloads/request-link",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("signed-in order downloads", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("creates direct access and navigates without sending another email", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          accessUrl: "/downloads",
          expiresAt: "2099-08-13T16:00:00.000Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<DigitalOrderDownloads orderId={ORDER_ID} fileCount={2} />);
    await user.click(screen.getByRole("button", { name: "View 2 downloads" }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/downloads");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/customer/orders/${ORDER_ID}/digital-access`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByRole("link", { name: "Request an emailed link" })).toBeTruthy();
  });

  test("keeps a failed direct-access action recoverable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Digital access is temporarily unavailable." }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const user = userEvent.setup();

    render(<DigitalOrderDownloads orderId={ORDER_ID} fileCount={1} />);
    await user.click(screen.getByRole("button", { name: "View download" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Digital access is temporarily unavailable.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  test("explains dispute suspension without offering an unusable access link", () => {
    render(<DigitalOrderDownloads orderId={ORDER_ID} fileCount={2} activeFileCount={0} accessStatus="suspended" />);

    expect(screen.getByText(/temporarily unavailable while a payment dispute is reviewed/i)).toBeTruthy();
    expect(screen.getByText(/download grants are preserved/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /View/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Request an emailed link" })).toBeNull();
  });

  test("explains full-refund revocation without offering recovery", () => {
    render(<DigitalOrderDownloads orderId={ORDER_ID} fileCount={1} activeFileCount={0} accessStatus="revoked" />);

    expect(screen.getByText(/removed after this order was fully refunded/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /View/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Request an emailed link" })).toBeNull();
  });

  test("keeps available files actionable when only part of an order is available", () => {
    render(<DigitalOrderDownloads orderId={ORDER_ID} fileCount={2} activeFileCount={1} accessStatus="active" />);

    expect(screen.getByText(/1 of 2 purchased files is currently available/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "View download" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Request an emailed link" })).toBeTruthy();
  });
});
