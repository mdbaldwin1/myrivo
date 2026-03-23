"use client";

import { useEffect, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type PickupOverrideResponse = {
  order: {
    id: string;
    pickupLocationId: string | null;
    pickupWindowStartAt: string | null;
    pickupWindowEndAt: string | null;
    pickupTimezone: string | null;
  };
  pickupSettings: {
    timezone: string;
    showPickupTimes: boolean;
  };
  locations: Array<{
    id: string;
    label: string;
    snapshot: Record<string, unknown>;
  }>;
  selectedLocationId: string | null;
  slots: Array<{
    startsAt: string;
    endsAt: string;
  }>;
  error?: string;
};

type PickupOverrideOrder = {
  id: string;
  customer_email: string;
  subtotal_cents: number;
  total_cents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  fulfillment_method: "pickup" | "shipping" | null;
  fulfillment_label: string | null;
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  pickup_location_id: string | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
  discount_cents: number;
  promo_code: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipment_status: string | null;
  created_at: string;
  order_fee_breakdowns?:
    | {
        platform_fee_cents: number;
        net_payout_cents: number;
        fee_bps: number;
        fee_fixed_cents: number;
        plan_key: string | null;
      }
    | Array<{
        platform_fee_cents: number;
        net_payout_cents: number;
        fee_bps: number;
        fee_fixed_cents: number;
        plan_key: string | null;
      }>
    | null;
};

type OrderPickupOverridePanelProps = {
  orderId: string | null;
  onSavingChange?: (saving: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (order: PickupOverrideOrder) => void;
  onError?: (message: string | null) => void;
};

function formatSlotLabel(startsAt: string, endsAt: string, timezone: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(start)} - ${new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeStyle: "short"
  }).format(end)}`;
}

export function OrderPickupOverridePanel({ orderId, onSavingChange, onDirtyChange, onSaved, onError }: OrderPickupOverridePanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PickupOverrideResponse | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    onSavingChange?.(saving);
  }, [onSavingChange, saving]);

  useEffect(() => {
    const dirty = Boolean(reason.trim()) || (data !== null && (selectedLocationId !== (data.selectedLocationId ?? "") || selectedSlotKey !== ""));
    onDirtyChange?.(dirty);
  }, [data, onDirtyChange, reason, selectedLocationId, selectedSlotKey]);

  useEffect(() => {
    if (!orderId) {
      return;
    }
    const resolvedOrderId = orderId;

    let cancelled = false;

    async function load(locationId?: string) {
      setLoading(true);
      setError(null);
      onError?.(null);
      const params = new URLSearchParams();
      params.set("orderId", resolvedOrderId);
      if (locationId) {
        params.set("locationId", locationId);
      }
      const response = await fetch(`/api/orders/pickup-override?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as PickupOverrideResponse;
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (!response.ok || !payload.order) {
        const nextError = payload.error ?? "Unable to load pickup override options.";
        setError(nextError);
        onError?.(nextError);
        return;
      }
      setData(payload);
      const nextLocationId = payload.selectedLocationId ?? "";
      setSelectedLocationId(nextLocationId);
      if (payload.order.pickupLocationId === nextLocationId && payload.order.pickupWindowStartAt && payload.order.pickupWindowEndAt) {
        const currentSlotKey = `${payload.order.pickupWindowStartAt}|${payload.order.pickupWindowEndAt}`;
        const matchingCurrentSlot = payload.slots.some((slot) => `${slot.startsAt}|${slot.endsAt}` === currentSlotKey);
        setSelectedSlotKey(matchingCurrentSlot ? currentSlotKey : "");
      } else {
        setSelectedSlotKey("");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [onError, orderId]);

  const slots = data?.slots ?? [];
  const slotOptions = slots.map((slot) => ({
    value: `${slot.startsAt}|${slot.endsAt}`,
    label: formatSlotLabel(slot.startsAt, slot.endsAt, data?.pickupSettings.timezone ?? "UTC")
  }));

  async function reloadForLocation(locationId: string) {
    if (!orderId) {
      return;
    }
    setLoading(true);
    setError(null);
    onError?.(null);
    const params = new URLSearchParams({ orderId, locationId });
    const response = await fetch(`/api/orders/pickup-override?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as PickupOverrideResponse;
    setLoading(false);
    if (!response.ok || !payload.order) {
      const nextError = payload.error ?? "Unable to load pickup slots.";
      setError(nextError);
      onError?.(nextError);
      return;
    }
    setData(payload);
    setSelectedLocationId(payload.selectedLocationId ?? "");
    setSelectedSlotKey("");
  }

  async function submit() {
    if (!orderId || !selectedLocationId || !selectedSlotKey || !reason.trim()) {
      return;
    }

    const [startsAt, endsAt] = selectedSlotKey.split("|");
    setSaving(true);
    setError(null);
    onError?.(null);
    const response = await fetch("/api/orders/pickup-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        locationId: selectedLocationId,
        startsAt,
        endsAt,
        reason: reason.trim()
      })
    });
    const payload = (await response.json().catch(() => ({}))) as { order?: PickupOverrideOrder; error?: string };
    setSaving(false);
    if (!response.ok || !payload.order) {
      const nextError = payload.error ?? "Unable to reschedule pickup.";
      setError(nextError);
      onError?.(nextError);
      return;
    }
    setReason("");
    onSaved?.(payload.order);
  }

  const currentSlotLabel =
    data?.order.pickupWindowStartAt && data.order.pickupWindowEndAt && data.order.pickupTimezone
      ? formatSlotLabel(data.order.pickupWindowStartAt, data.order.pickupWindowEndAt, data.order.pickupTimezone)
      : "No pickup window selected";

  return (
    <form
      id="pickup-override-form"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {loading ? <p className="text-sm text-muted-foreground">Loading pickup override options...</p> : null}
      <AppAlert variant="error" message={error} />

      {data ? (
        <>
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3 text-sm">
            <p className="font-medium">Current pickup details</p>
            <p className="mt-1 text-muted-foreground">
              Location: {data.locations.find((location) => location.id === data.order.pickupLocationId)?.label ?? "Not set"}
            </p>
            <p className="text-muted-foreground">Window: {currentSlotLabel}</p>
          </div>

          <FormField label="New pickup location" description="Choose an active store pickup location.">
            <Select
              value={selectedLocationId}
              placeholder="Select location"
              onChange={(event) => {
                const nextLocationId = event.target.value;
                setSelectedLocationId(nextLocationId);
                void reloadForLocation(nextLocationId);
              }}
              disabled={loading || saving}
            >
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="New pickup window" description="Only currently available pickup windows can be selected.">
            <Select
              value={selectedSlotKey}
              placeholder={slotOptions.length > 0 ? "Select pickup window" : "No pickup windows available"}
              onChange={(event) => setSelectedSlotKey(event.target.value)}
              disabled={loading || saving || slotOptions.length === 0}
            >
              {slotOptions.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Reason for override"
            description="This is required and will be included in the customer notification and audit trail."
          >
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why the store needs to change the pickup details."
            />
          </FormField>

          <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            Saving this change overrides the customer-selected pickup details and sends the customer an immediate update by email and in-app notification.
          </div>
        </>
      ) : null}
    </form>
  );
}
