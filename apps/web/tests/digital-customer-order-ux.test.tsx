/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CustomerOrderDetailView } from "@/components/customer/customer-order-detail-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

afterEach(cleanup);

describe("customer digital order detail", () => {
  test("puts downloads before order details and omits physical fulfillment state for a digital-only order", () => {
    render(
      <CustomerOrderDetailView
        order={{
          id: "40000000-0000-4000-8000-000000000501",
          store_id: "store-1",
          customer_email: "buyer@example.com",
          customer_first_name: "Taylor",
          customer_last_name: "Buyer",
          customer_note: null,
          fulfillment_method: "digital_delivery",
          fulfillment_label: "Digital delivery",
          pickup_location_snapshot_json: null,
          pickup_window_start_at: null,
          pickup_window_end_at: null,
          pickup_timezone: null,
          status: "paid",
          fulfillment_status: "pending_fulfillment",
          created_at: "2026-08-13T12:00:00.000Z",
          fulfilled_at: null,
          shipped_at: null,
          delivered_at: null,
          subtotal_cents: 2800,
          shipping_fee_cents: 0,
          discount_cents: 0,
          total_cents: 2800,
          currency: "usd",
          carrier: null,
          tracking_number: null,
          tracking_url: null,
          shipment_status: null,
          stores: { id: "store-1", name: "Print Shop", slug: "print-shop" }
        }}
        items={[{ id: "item-1", quantity: 1, unit_price_cents: 2800, variant_label: "PDF", products: { id: "product-1", title: "Printable" } }]}
        shippingDelays={[]}
        backHref="/dashboard"
        digitalDownloads={{ fileCount: 1, activeFileCount: 1, accessStatus: "active", accessReason: null }}
      />
    );

    const downloads = screen.getByRole("heading", { name: "Digital downloads" });
    const items = screen.getByText("Products included in this order.");
    expect(downloads.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("pending fulfillment")).toBeNull();
    expect(screen.queryByText("Shipping or pickup details for this order.")).toBeNull();
  });
});
