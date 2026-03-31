/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PickupSettingsManager } from "@/components/dashboard/pickup-settings-manager";

const notifySuccessMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/stores/apothecary/store-settings/fulfillment"
}));

vi.mock("@/lib/feedback/toast", () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccessMock(...args)
  }
}));

vi.mock("@/lib/routes/store-workspace", () => ({
  buildStoreScopedApiPath: (path: string, storeSlug?: string | null) => `${path}?storeSlug=${storeSlug ?? ""}`,
  getStoreSlugFromDashboardPathname: () => "apothecary"
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onChange
  }: {
    checked?: boolean;
    onChange?: (event: { target: { checked: boolean } }) => void;
  }) => <input type="checkbox" checked={checked} onChange={(event) => onChange?.({ target: { checked: event.target.checked } })} />
}));

vi.mock("@/components/dashboard/dashboard-form-action-bar", () => ({
  DashboardFormActionBar: ({
    formId,
    saveLabel,
    saveDisabled,
    discardDisabled
  }: {
    formId: string;
    saveLabel: string;
    saveDisabled: boolean;
    discardDisabled: boolean;
  }) => (
    <div>
      <button type="submit" form={formId} disabled={saveDisabled}>
        {saveLabel}
      </button>
      <button type="submit" form={formId} value="discard" disabled={discardDisabled}>
        Discard
      </button>
    </div>
  )
}));

describe("PickupSettingsManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    notifySuccessMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test("keeps the storefront pickup option enabled when pickup availability rules are turned off", async () => {
    const settingsPutBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/stores/settings") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            settings: {
              checkout_enable_flat_rate_shipping: true,
              checkout_flat_rate_shipping_label: "Shipping",
              checkout_flat_rate_shipping_fee_cents: 0,
              checkout_enable_local_pickup: true,
              checkout_local_pickup_label: "Local pickup",
              checkout_local_pickup_fee_cents: 0
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/settings") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            settings: {
              pickup_enabled: true,
              selection_mode: "buyer_select",
              geolocation_fallback_mode: "allow_without_distance",
              out_of_radius_behavior: "disable_pickup",
              eligibility_radius_miles: 25,
              lead_time_hours: 24,
              slot_interval_minutes: 60,
              show_pickup_times: true,
              timezone: "America/New_York",
              instructions: null
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/locations") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ locations: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("/api/stores/pickup/hours") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ hours: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("/api/stores/pickup/blackouts") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ blackouts: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("/api/stores/settings") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        settingsPutBodies.push(body);

        return new Response(
          JSON.stringify({
            settings: {
              checkout_enable_flat_rate_shipping: true,
              checkout_flat_rate_shipping_label: "Shipping",
              checkout_flat_rate_shipping_fee_cents: 0,
              checkout_enable_local_pickup: body.checkoutEnableLocalPickup,
              checkout_local_pickup_label: "Local pickup",
              checkout_local_pickup_fee_cents: 0
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/settings") && init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            settings: {
              pickup_enabled: false,
              selection_mode: "buyer_select",
              geolocation_fallback_mode: "allow_without_distance",
              out_of_radius_behavior: "disable_pickup",
              eligibility_radius_miles: 25,
              lead_time_hours: 24,
              slot_interval_minutes: 60,
              show_pickup_times: true,
              timezone: "America/New_York",
              instructions: null
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<PickupSettingsManager showShippingOfferSettings />);

    await waitFor(() => {
      expect(screen.getByText("Enable pickup availability rules")).toBeTruthy();
    });

    const pickupAvailabilityToggle = screen.getByRole("checkbox", { name: "Enable pickup availability rules" });
    await userEvent.setup().click(pickupAvailabilityToggle);

    const saveButton = screen.getByRole("button", { name: "Save fulfillment settings" });
    await userEvent.setup().click(saveButton);

    await waitFor(() => {
      expect(settingsPutBodies).toHaveLength(1);
    });

    expect(settingsPutBodies[0]?.checkoutEnableLocalPickup).toBe(true);
    expect(notifySuccessMock).toHaveBeenCalledWith("Fulfillment settings saved.");
  });

  test("shows pickup readiness issues when coordinates and hours are missing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/stores/settings") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            settings: {
              checkout_enable_flat_rate_shipping: true,
              checkout_flat_rate_shipping_label: "Shipping",
              checkout_flat_rate_shipping_fee_cents: 0,
              checkout_enable_local_pickup: true,
              checkout_local_pickup_label: "Local pickup",
              checkout_local_pickup_fee_cents: 0
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/settings") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            settings: {
              pickup_enabled: true,
              selection_mode: "buyer_select",
              geolocation_fallback_mode: "disable_pickup",
              out_of_radius_behavior: "disable_pickup",
              eligibility_radius_miles: 100,
              lead_time_hours: 48,
              slot_interval_minutes: 15,
              show_pickup_times: true,
              timezone: "America/New_York",
              instructions: null
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/locations") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            locations: [
              {
                id: "location-1",
                name: "Main pickup",
                address_line1: "123 Main",
                city: "Virginia Beach",
                state_region: "VA",
                postal_code: "23452",
                latitude: null,
                longitude: null,
                is_active: true
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/hours") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ hours: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("/api/stores/pickup/blackouts") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ blackouts: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<PickupSettingsManager showShippingOfferSettings />);

    await waitFor(() => {
      expect(screen.getByText("Pickup readiness")).toBeTruthy();
    });

    expect(screen.getByText(/missing 2 required steps/i)).toBeTruthy();
    expect(screen.getByText(/add latitude and longitude to at least one active pickup location/i)).toBeTruthy();
    expect(screen.getByText(/add pickup hours for at least one active location or turn off pickup times/i)).toBeTruthy();
    expect(screen.getByText("Pickup Options")).toBeTruthy();
    expect(screen.getByText(/each pickup option keeps its location details, schedule, and blackout windows together/i)).toBeTruthy();
  });

  test("hides pickup readiness and setup when the local pickup option is disabled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/stores/settings") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            settings: {
              checkout_enable_flat_rate_shipping: true,
              checkout_flat_rate_shipping_label: "Shipping",
              checkout_flat_rate_shipping_fee_cents: 0,
              checkout_enable_local_pickup: false,
              checkout_local_pickup_label: "Local pickup",
              checkout_local_pickup_fee_cents: 0
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/settings") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            settings: {
              pickup_enabled: true,
              selection_mode: "buyer_select",
              geolocation_fallback_mode: "disable_pickup",
              out_of_radius_behavior: "disable_pickup",
              eligibility_radius_miles: 100,
              lead_time_hours: 48,
              slot_interval_minutes: 15,
              show_pickup_times: true,
              timezone: "America/New_York",
              instructions: null
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.startsWith("/api/stores/pickup/locations") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ locations: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("/api/stores/pickup/hours") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ hours: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.startsWith("/api/stores/pickup/blackouts") && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ blackouts: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<PickupSettingsManager showShippingOfferSettings />);

    await waitFor(() => {
      expect(screen.getByText(/enable the local pickup option above to show pickup setup here/i)).toBeTruthy();
    });

    expect(screen.queryByText("Pickup readiness")).toBeNull();
  });
});
