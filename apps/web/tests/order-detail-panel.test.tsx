// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel";

describe("OrderDetailPanel", () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        order: {
          id: "order-1",
          customer_email: "buyer@example.com",
          customer_first_name: "Taylor",
          customer_last_name: "Buyer",
          customer_phone: null,
          customer_note: "Please include a gift note.",
          subtotal_cents: 2800,
          total_cents: 2800,
          status: "paid",
          fulfillment_method: "shipping",
          fulfillment_label: "Shipping",
          fulfillment_status: "pending_fulfillment",
          pickup_location_id: null,
          pickup_location_snapshot_json: null,
          pickup_window_start_at: null,
          pickup_window_end_at: null,
          pickup_timezone: null,
          fulfilled_at: null,
          shipped_at: null,
          delivered_at: null,
          discount_cents: 0,
          promo_code: null,
          currency: "usd",
          carrier: null,
          tracking_number: null,
          tracking_url: null,
          shipment_status: null,
          last_tracking_sync_at: null,
          created_at: "2026-04-06T12:00:00.000Z",
          order_fee_breakdowns: null
        },
        items: [],
        refunds: [],
        disputes: [],
        shippingDelays: [],
        timelineEvents: []
      })
    }));

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders the customer note when the order has one", async () => {
    render(<OrderDetailPanel orderId="order-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer note")).toBeTruthy();
    });

    expect(screen.getByText("Please include a gift note.")).toBeTruthy();
  });
});
