"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

type PickupSettings = {
  pickup_enabled: boolean;
  selection_mode: "buyer_select" | "hidden_nearest";
  geolocation_fallback_mode: "allow_without_distance" | "disable_pickup";
  out_of_radius_behavior: "disable_pickup" | "allow_all_locations";
  eligibility_radius_miles: number;
  lead_time_hours: number;
  slot_interval_minutes: 15 | 30 | 60 | 120;
  show_pickup_times: boolean;
  timezone: string;
  instructions: string | null;
};

type CheckoutPickupSettings = {
  checkout_enable_local_pickup: boolean;
  checkout_local_pickup_label: string | null;
  checkout_local_pickup_fee_cents: number;
};

type ShippingCheckoutSettings = {
  checkout_enable_flat_rate_shipping: boolean;
  checkout_flat_rate_shipping_label: string | null;
  checkout_flat_rate_shipping_fee_cents: number;
};

type PickupLocation = {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state_region: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
};

type PickupHoursRow = {
  id: string;
  pickup_location_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

type PickupBlackoutRow = {
  id: string;
  pickup_location_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

type PickupScheduleDraft = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
};

type PickupConfigurationIssue = {
  severity: "error" | "warning";
  message: string;
};

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
];

function createDefaultScheduleWindow(): PickupScheduleDraft {
  return { dayOfWeek: 1, opensAt: "09:00", closesAt: "17:00" };
}

function arePickupSettingsEqual(left: PickupSettings | null, right: PickupSettings | null) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.pickup_enabled === right.pickup_enabled &&
    left.selection_mode === right.selection_mode &&
    left.geolocation_fallback_mode === right.geolocation_fallback_mode &&
    left.out_of_radius_behavior === right.out_of_radius_behavior &&
    left.eligibility_radius_miles === right.eligibility_radius_miles &&
    left.lead_time_hours === right.lead_time_hours &&
    left.slot_interval_minutes === right.slot_interval_minutes &&
    left.show_pickup_times === right.show_pickup_times &&
    left.timezone === right.timezone &&
    (left.instructions ?? "") === (right.instructions ?? "")
  );
}

function areCheckoutPickupSettingsEqual(left: CheckoutPickupSettings | null, right: CheckoutPickupSettings | null) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.checkout_enable_local_pickup === right.checkout_enable_local_pickup &&
    (left.checkout_local_pickup_label ?? "") === (right.checkout_local_pickup_label ?? "") &&
    left.checkout_local_pickup_fee_cents === right.checkout_local_pickup_fee_cents
  );
}

function areShippingCheckoutSettingsEqual(left: ShippingCheckoutSettings | null, right: ShippingCheckoutSettings | null) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.checkout_enable_flat_rate_shipping === right.checkout_enable_flat_rate_shipping &&
    (left.checkout_flat_rate_shipping_label ?? "") === (right.checkout_flat_rate_shipping_label ?? "") &&
    left.checkout_flat_rate_shipping_fee_cents === right.checkout_flat_rate_shipping_fee_cents
  );
}

function getPickupConfigurationIssues({
  pickupSettings,
  checkoutSettings,
  locations,
  hours,
  hideBuilderOfferSettings
}: {
  pickupSettings: PickupSettings | null;
  checkoutSettings: CheckoutPickupSettings | null;
  locations: PickupLocation[];
  hours: PickupHoursRow[];
  hideBuilderOfferSettings: boolean;
}) {
  const issues: PickupConfigurationIssue[] = [];

  if (!pickupSettings) {
    return issues;
  }

  const activeLocations = locations.filter((location) => location.is_active);
  const activeLocationIds = new Set(activeLocations.map((location) => location.id));
  const locationsWithCoordinates = activeLocations.filter(
    (location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
  );
  const locationsWithHours = new Set(hours.filter((row) => activeLocationIds.has(row.pickup_location_id)).map((row) => row.pickup_location_id));

  if (!hideBuilderOfferSettings && checkoutSettings?.checkout_enable_local_pickup && !pickupSettings.pickup_enabled) {
    issues.push({
      severity: "warning",
      message: "Checkout is set to offer pickup, but pickup availability rules are turned off."
    });
  }

  if (!pickupSettings.pickup_enabled) {
    return issues;
  }

  if (activeLocations.length === 0) {
    issues.push({
      severity: "error",
      message: "Add at least one active pickup location before enabling pickup at checkout."
    });
  }

  if (locationsWithCoordinates.length === 0) {
    issues.push({
      severity: "error",
      message: "Add latitude and longitude to at least one active pickup location so buyers can qualify for pickup."
    });
  }

  if (pickupSettings.show_pickup_times && locationsWithHours.size === 0) {
    issues.push({
      severity: "error",
      message: "Add pickup hours for at least one active location or turn off pickup times."
    });
  }

  if (pickupSettings.show_pickup_times && locationsWithHours.size > 0 && locationsWithHours.size < activeLocations.length) {
    issues.push({
      severity: "warning",
      message: "Some active pickup locations do not have pickup hours yet, so they will not offer time slots."
    });
  }

  return issues;
}

type PickupSettingsManagerProps = {
  header?: ReactNode;
  hideBuilderOfferSettings?: boolean;
  showShippingOfferSettings?: boolean;
};

export function PickupSettingsManager({
  header,
  hideBuilderOfferSettings = false,
  showShippingOfferSettings = false
}: PickupSettingsManagerProps) {
  const formId = "pickup-config-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickupSettings, setPickupSettings] = useState<PickupSettings | null>(null);
  const [savedPickupSettings, setSavedPickupSettings] = useState<PickupSettings | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutPickupSettings | null>(null);
  const [savedCheckoutSettings, setSavedCheckoutSettings] = useState<CheckoutPickupSettings | null>(null);
  const [shippingSettings, setShippingSettings] = useState<ShippingCheckoutSettings | null>(null);
  const [savedShippingSettings, setSavedShippingSettings] = useState<ShippingCheckoutSettings | null>(null);

  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [hours, setHours] = useState<PickupHoursRow[]>([]);
  const [blackouts, setBlackouts] = useState<PickupBlackoutRow[]>([]);

  const [selectedHoursLocationId, setSelectedHoursLocationId] = useState<string>("");
  const [hoursDraft, setHoursDraft] = useState<PickupScheduleDraft[]>([]);

  const [blackoutLocationId, setBlackoutLocationId] = useState<string>("all");
  const [blackoutStartAt, setBlackoutStartAt] = useState<string>("");
  const [blackoutEndAt, setBlackoutEndAt] = useState<string>("");
  const [blackoutReason, setBlackoutReason] = useState<string>("");

  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [newLocationCity, setNewLocationCity] = useState("");
  const [newLocationState, setNewLocationState] = useState("");
  const [newLocationPostal, setNewLocationPostal] = useState("");
  const [newLocationLat, setNewLocationLat] = useState("");
  const [newLocationLng, setNewLocationLng] = useState("");

  const isDirty = Boolean(
    pickupSettings &&
      savedPickupSettings &&
      (!arePickupSettingsEqual(pickupSettings, savedPickupSettings) ||
        (!hideBuilderOfferSettings && !areCheckoutPickupSettingsEqual(checkoutSettings, savedCheckoutSettings)) ||
        (showShippingOfferSettings && !areShippingCheckoutSettingsEqual(shippingSettings, savedShippingSettings)))
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [settingsResponse, pickupResponse, locationsResponse, hoursResponse, blackoutsResponse] = await Promise.all([
      hideBuilderOfferSettings && !showShippingOfferSettings
        ? Promise.resolve(new Response(JSON.stringify({ settings: null }), { status: 200, headers: { "Content-Type": "application/json" } }))
        : fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/settings", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/locations", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/hours", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/blackouts", storeSlug), { cache: "no-store" })
    ]);

    const settingsPayload = (await settingsResponse.json()) as {
      settings?: {
        checkout_enable_flat_rate_shipping?: boolean;
        checkout_flat_rate_shipping_label?: string | null;
        checkout_flat_rate_shipping_fee_cents?: number;
        checkout_enable_local_pickup?: boolean;
        checkout_local_pickup_label?: string | null;
        checkout_local_pickup_fee_cents?: number;
      };
      error?: string;
    };
    const pickupPayload = (await pickupResponse.json()) as { settings?: PickupSettings; error?: string };
    const locationsPayload = (await locationsResponse.json()) as { locations?: PickupLocation[]; error?: string };
    const hoursPayload = (await hoursResponse.json()) as { hours?: PickupHoursRow[]; error?: string };
    const blackoutsPayload = (await blackoutsResponse.json()) as { blackouts?: PickupBlackoutRow[]; error?: string };

    if (!settingsResponse.ok) {
      setError(settingsPayload.error ?? "Unable to load pickup checkout settings.");
      setLoading(false);
      return;
    }
    if (!pickupResponse.ok) {
      setError(pickupPayload.error ?? "Unable to load pickup settings.");
      setLoading(false);
      return;
    }
    if (!locationsResponse.ok) {
      setError(locationsPayload.error ?? "Unable to load pickup locations.");
      setLoading(false);
      return;
    }
    if (!hoursResponse.ok) {
      setError(hoursPayload.error ?? "Unable to load pickup hours.");
      setLoading(false);
      return;
    }
    if (!blackoutsResponse.ok) {
      setError(blackoutsPayload.error ?? "Unable to load pickup blackouts.");
      setLoading(false);
      return;
    }

    if (showShippingOfferSettings) {
      const resolvedShipping: ShippingCheckoutSettings = {
        checkout_enable_flat_rate_shipping: settingsPayload.settings?.checkout_enable_flat_rate_shipping ?? true,
        checkout_flat_rate_shipping_label: settingsPayload.settings?.checkout_flat_rate_shipping_label ?? "Shipping",
        checkout_flat_rate_shipping_fee_cents: settingsPayload.settings?.checkout_flat_rate_shipping_fee_cents ?? 0
      };

      setShippingSettings(resolvedShipping);
      setSavedShippingSettings(resolvedShipping);
    } else {
      setShippingSettings(null);
      setSavedShippingSettings(null);
    }

    if (!hideBuilderOfferSettings) {
      const resolvedCheckout: CheckoutPickupSettings = {
        checkout_enable_local_pickup: settingsPayload.settings?.checkout_enable_local_pickup ?? false,
        checkout_local_pickup_label: settingsPayload.settings?.checkout_local_pickup_label ?? "Local pickup",
        checkout_local_pickup_fee_cents: settingsPayload.settings?.checkout_local_pickup_fee_cents ?? 0
      };

      setCheckoutSettings(resolvedCheckout);
      setSavedCheckoutSettings(resolvedCheckout);
    } else {
      setCheckoutSettings(null);
      setSavedCheckoutSettings(null);
    }

    setPickupSettings(pickupPayload.settings ?? null);
    setSavedPickupSettings(pickupPayload.settings ?? null);

    const nextLocations = locationsPayload.locations ?? [];
    const nextHours = hoursPayload.hours ?? [];
    setLocations(nextLocations);
    setHours(nextHours);
    setBlackouts(blackoutsPayload.blackouts ?? []);

    const defaultLocationId = nextLocations[0]?.id ?? "";
    setSelectedHoursLocationId(defaultLocationId);
    setHoursDraft(
      nextHours
        .filter((row) => row.pickup_location_id === defaultLocationId)
        .map((row) => ({
          dayOfWeek: row.day_of_week,
          opensAt: row.opens_at,
          closesAt: row.closes_at
        }))
    );

    setLoading(false);
  }, [hideBuilderOfferSettings, showShippingOfferSettings, storeSlug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadData]);

  function resetCoreChanges() {
    if (!savedPickupSettings || (!hideBuilderOfferSettings && !savedCheckoutSettings)) {
      return;
    }

    setPickupSettings(savedPickupSettings);
    if (!hideBuilderOfferSettings) {
      setCheckoutSettings(savedCheckoutSettings);
    }
    if (showShippingOfferSettings) {
      setShippingSettings(savedShippingSettings);
    }
    setError(null);
  }

  async function saveCoreConfig() {
    if (!pickupSettings || (!hideBuilderOfferSettings && !checkoutSettings)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let nextCheckout: CheckoutPickupSettings | null = null;
      let nextShipping: ShippingCheckoutSettings | null = null;

      if (showShippingOfferSettings || (!hideBuilderOfferSettings && checkoutSettings)) {
        const shippingFeeCents = Number.parseInt(String(shippingSettings?.checkout_flat_rate_shipping_fee_cents ?? 0), 10);
        const localPickupFeeCents = Number.parseInt(String(checkoutSettings?.checkout_local_pickup_fee_cents ?? 0), 10);
        const effectiveCheckoutEnableLocalPickup = pickupSettings.pickup_enabled
          ? (checkoutSettings?.checkout_enable_local_pickup ?? false)
          : false;

        if (!Number.isInteger(shippingFeeCents) || shippingFeeCents < 0) {
          setError("Shipping fee must be a non-negative integer amount in cents.");
          setSaving(false);
          return;
        }

        if (!Number.isInteger(localPickupFeeCents) || localPickupFeeCents < 0) {
          setError("Pickup fee must be a non-negative integer amount in cents.");
          setSaving(false);
          return;
        }

        const settingsResponse = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(showShippingOfferSettings
              ? {
                  checkoutEnableFlatRateShipping: shippingSettings?.checkout_enable_flat_rate_shipping ?? true,
                  checkoutFlatRateShippingLabel: shippingSettings?.checkout_flat_rate_shipping_label?.trim() || null,
                  checkoutFlatRateShippingFeeCents: shippingFeeCents
                }
              : {}),
            ...(!hideBuilderOfferSettings && checkoutSettings
              ? {
                  checkoutEnableLocalPickup: effectiveCheckoutEnableLocalPickup,
                  checkoutLocalPickupLabel: checkoutSettings.checkout_local_pickup_label?.trim() || null,
                  checkoutLocalPickupFeeCents: localPickupFeeCents
                }
              : {})
          })
        });

        const settingsPayload = (await settingsResponse.json()) as {
          settings?: {
            checkout_enable_flat_rate_shipping?: boolean;
            checkout_flat_rate_shipping_label?: string | null;
            checkout_flat_rate_shipping_fee_cents?: number;
            checkout_enable_local_pickup?: boolean;
            checkout_local_pickup_label?: string | null;
            checkout_local_pickup_fee_cents?: number;
          };
          error?: string;
        };

        if (!settingsResponse.ok) {
          setError(settingsPayload.error ?? "Unable to save fulfillment checkout settings.");
          setSaving(false);
          return;
        }

        if (showShippingOfferSettings && shippingSettings) {
          nextShipping = {
            checkout_enable_flat_rate_shipping:
              settingsPayload.settings?.checkout_enable_flat_rate_shipping ?? shippingSettings.checkout_enable_flat_rate_shipping,
            checkout_flat_rate_shipping_label:
              settingsPayload.settings?.checkout_flat_rate_shipping_label ?? shippingSettings.checkout_flat_rate_shipping_label,
            checkout_flat_rate_shipping_fee_cents:
              settingsPayload.settings?.checkout_flat_rate_shipping_fee_cents ?? shippingSettings.checkout_flat_rate_shipping_fee_cents
          };
        }

        if (!hideBuilderOfferSettings && checkoutSettings) {
          nextCheckout = {
            checkout_enable_local_pickup:
              settingsPayload.settings?.checkout_enable_local_pickup ?? effectiveCheckoutEnableLocalPickup,
            checkout_local_pickup_label:
              settingsPayload.settings?.checkout_local_pickup_label ?? checkoutSettings.checkout_local_pickup_label,
            checkout_local_pickup_fee_cents:
              settingsPayload.settings?.checkout_local_pickup_fee_cents ?? checkoutSettings.checkout_local_pickup_fee_cents
          };
        }
      }

      const pickupResponse = await fetch(buildStoreScopedApiPath("/api/stores/pickup/settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupEnabled: pickupSettings.pickup_enabled,
          selectionMode: pickupSettings.selection_mode,
          geolocationFallbackMode: pickupSettings.geolocation_fallback_mode,
          outOfRadiusBehavior: pickupSettings.out_of_radius_behavior,
          eligibilityRadiusMiles: pickupSettings.eligibility_radius_miles,
          leadTimeHours: pickupSettings.lead_time_hours,
          slotIntervalMinutes: pickupSettings.slot_interval_minutes,
          showPickupTimes: pickupSettings.show_pickup_times,
          timezone: pickupSettings.timezone.trim(),
          instructions: pickupSettings.instructions?.trim() || null
        })
      });
      const pickupPayload = (await pickupResponse.json()) as { settings?: PickupSettings; error?: string };

      if (!pickupResponse.ok) {
        setError(pickupPayload.error ?? "Unable to save pickup settings.");
        setSaving(false);
        return;
      }

      const nextPickup = pickupPayload.settings ?? pickupSettings;

      if (nextCheckout) {
        setCheckoutSettings(nextCheckout);
        setSavedCheckoutSettings(nextCheckout);
      }
      if (nextShipping) {
        setShippingSettings(nextShipping);
        setSavedShippingSettings(nextShipping);
      }

      setPickupSettings(nextPickup);
      setSavedPickupSettings(nextPickup);
      notify.success(showShippingOfferSettings ? "Fulfillment settings saved." : "Pickup settings saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCoreConfigSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (submitter?.value === "discard") {
      resetCoreChanges();
      return;
    }

    await saveCoreConfig();
  }

  async function addLocation() {
    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/pickup/locations", storeSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newLocationName,
        addressLine1: newLocationAddress,
        city: newLocationCity,
        stateRegion: newLocationState,
        postalCode: newLocationPostal,
        latitude: newLocationLat.trim() ? Number.parseFloat(newLocationLat) : null,
        longitude: newLocationLng.trim() ? Number.parseFloat(newLocationLng) : null,
        isActive: true
      })
    });

    const payload = (await response.json()) as { location?: PickupLocation; error?: string };

    if (!response.ok || !payload.location) {
      setError(payload.error ?? "Unable to create pickup location.");
      setSaving(false);
      return;
    }

    setLocations((current) => [...current, payload.location as PickupLocation]);
    setNewLocationName("");
    setNewLocationAddress("");
    setNewLocationCity("");
    setNewLocationState("");
    setNewLocationPostal("");
    setNewLocationLat("");
    setNewLocationLng("");
    setSaving(false);
    notify.success("Pickup location added.");
  }

  async function removeLocation(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath(`/api/stores/pickup/locations/${id}`, storeSlug), { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to remove pickup location.");
      setSaving(false);
      return;
    }

    setLocations((current) => current.filter((entry) => entry.id !== id));

    if (selectedHoursLocationId === id) {
      const nextLocationId = locations.find((entry) => entry.id !== id)?.id ?? "";
      setSelectedHoursLocationId(nextLocationId);
      setHoursDraft(
        hours
          .filter((entry) => entry.pickup_location_id === nextLocationId)
          .map((entry) => ({ dayOfWeek: entry.day_of_week, opensAt: entry.opens_at, closesAt: entry.closes_at }))
      );
    }

    setSaving(false);
    notify.success("Pickup location removed.");
  }

  async function saveHours() {
    if (!selectedHoursLocationId) {
      setError("Select a pickup location before saving hours.");
      return;
    }

    for (const slot of hoursDraft) {
      if (!/^\d{2}:\d{2}$/.test(slot.opensAt) || !/^\d{2}:\d{2}$/.test(slot.closesAt) || slot.opensAt >= slot.closesAt) {
        setError("Each pickup time window must have valid HH:MM times and opens before closes.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/pickup/hours", storeSlug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: selectedHoursLocationId,
        hours: hoursDraft
      })
    });

    const payload = (await response.json()) as { hours?: PickupHoursRow[]; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to save pickup hours.");
      setSaving(false);
      return;
    }

    setHours(payload.hours ?? []);
    setSaving(false);
    notify.success("Pickup schedule saved.");
  }

  async function addBlackout() {
    if (!blackoutStartAt || !blackoutEndAt) {
      setError("Select blackout start and end times.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/pickup/blackouts", storeSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupLocationId: blackoutLocationId === "all" ? null : blackoutLocationId,
        startsAt: new Date(blackoutStartAt).toISOString(),
        endsAt: new Date(blackoutEndAt).toISOString(),
        reason: blackoutReason.trim() || null
      })
    });

    const payload = (await response.json()) as { blackout?: PickupBlackoutRow; error?: string };

    if (!response.ok || !payload.blackout) {
      setError(payload.error ?? "Unable to create blackout.");
      setSaving(false);
      return;
    }

    setBlackouts((current) => [...current, payload.blackout!]);
    setBlackoutStartAt("");
    setBlackoutEndAt("");
    setBlackoutReason("");
    setSaving(false);
    notify.success("Pickup blackout added.");
  }

  async function removeBlackout(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath(`/api/stores/pickup/blackouts/${id}`, storeSlug), { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to remove blackout.");
      setSaving(false);
      return;
    }

    setBlackouts((current) => current.filter((entry) => entry.id !== id));
    setSaving(false);
    notify.success("Pickup blackout removed.");
  }

  const hoursBySelectedLocation = useMemo(
    () => hours.filter((entry) => entry.pickup_location_id === selectedHoursLocationId),
    [hours, selectedHoursLocationId]
  );
  const pickupConfigurationIssues = useMemo(
    () =>
      getPickupConfigurationIssues({
        pickupSettings,
        checkoutSettings,
        locations,
        hours,
        hideBuilderOfferSettings
      }),
    [checkoutSettings, hideBuilderOfferSettings, hours, locations, pickupSettings]
  );
  const pickupErrorCount = pickupConfigurationIssues.filter((issue) => issue.severity === "error").length;
  const pickupWarningCount = pickupConfigurationIssues.filter((issue) => issue.severity === "warning").length;
  const showStorefrontPickupSettings = !hideBuilderOfferSettings && checkoutSettings;
  const saveLabel = showShippingOfferSettings ? "Save fulfillment settings" : "Save pickup settings";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading pickup settings...</p> : null}

        {!loading && pickupSettings && (hideBuilderOfferSettings || checkoutSettings) ? (
          <form id={formId} className="space-y-4" onSubmit={handleCoreConfigSubmit}>
            {showShippingOfferSettings && shippingSettings ? (
              <SectionCard title="Shipping" description="Configure the shipping option shown at checkout.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={shippingSettings.checkout_enable_flat_rate_shipping}
                      onChange={(event) =>
                        setShippingSettings((current) =>
                          current ? { ...current, checkout_enable_flat_rate_shipping: event.target.checked } : current
                        )
                      }
                    />
                    Enable flat-rate shipping option
                  </label>

                  {shippingSettings.checkout_enable_flat_rate_shipping ? (
                    <>
                      <FormField label="Shipping Label">
                        <Input
                          value={shippingSettings.checkout_flat_rate_shipping_label ?? ""}
                          onChange={(event) =>
                            setShippingSettings((current) =>
                              current ? { ...current, checkout_flat_rate_shipping_label: event.target.value } : current
                            )
                          }
                          placeholder="Shipping"
                        />
                      </FormField>

                      <FormField label="Shipping Fee (cents)">
                        <Input
                          type="number"
                          min={0}
                          value={shippingSettings.checkout_flat_rate_shipping_fee_cents}
                          onChange={(event) =>
                            setShippingSettings((current) =>
                              current
                                ? {
                                    ...current,
                                    checkout_flat_rate_shipping_fee_cents: Number.parseInt(event.target.value || "0", 10)
                                  }
                                : current
                            )
                          }
                        />
                      </FormField>
                    </>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard
              title={hideBuilderOfferSettings ? "Pickup operations" : "Local Pickup"}
              description={
                hideBuilderOfferSettings
                  ? "Configure availability rules, locations, schedules, blackout windows, and buyer-eligibility logic."
                  : "Configure pickup availability, buyer rules, locations, schedule, and blackout windows."
              }
            >
              <div className="space-y-3">
                {pickupConfigurationIssues.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                    <AppAlert
                      variant={pickupErrorCount > 0 ? "warning" : "info"}
                      title="Pickup readiness"
                      message={
                        pickupErrorCount > 0
                          ? `Pickup is missing ${pickupErrorCount} required ${pickupErrorCount === 1 ? "step" : "steps"} before it can work reliably at checkout.`
                          : `Pickup has ${pickupWarningCount} recommended ${pickupWarningCount === 1 ? "adjustment" : "adjustments"} to review.`
                      }
                    />
                    <ul className="space-y-1 pl-5 text-sm text-amber-900">
                      {pickupConfigurationIssues.map((issue) => (
                        <li key={issue.message} className="list-disc">
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <AppAlert
                    variant="success"
                    title="Pickup readiness"
                    message="Pickup has the core pieces needed for checkout: an active location, map coordinates, and pickup hours."
                  />
                )}

              <div className="grid gap-3 sm:grid-cols-2">
                {showStorefrontPickupSettings ? (
                  <>
                    <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={showStorefrontPickupSettings.checkout_enable_local_pickup}
                        onChange={(event) =>
                          setCheckoutSettings((current) =>
                            current ? { ...current, checkout_enable_local_pickup: event.target.checked } : current
                          )
                        }
                      />
                      Enable local pickup option
                    </label>

                    {showStorefrontPickupSettings.checkout_enable_local_pickup ? (
                      <>
                        <FormField label="Pickup Label">
                          <Input
                            value={showStorefrontPickupSettings.checkout_local_pickup_label ?? ""}
                            onChange={(event) =>
                              setCheckoutSettings((current) =>
                                current ? { ...current, checkout_local_pickup_label: event.target.value } : current
                              )
                            }
                            placeholder="Local pickup"
                          />
                        </FormField>

                        <FormField label="Pickup Fee (cents)">
                          <Input
                            type="number"
                            min={0}
                            value={showStorefrontPickupSettings.checkout_local_pickup_fee_cents}
                            onChange={(event) =>
                              setCheckoutSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      checkout_local_pickup_fee_cents: Number.parseInt(event.target.value || "0", 10)
                                    }
                                  : current
                              )
                            }
                          />
                        </FormField>
                      </>
                    ) : null}
                  </>
                ) : null}

                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={pickupSettings.pickup_enabled}
                    onChange={(event) =>
                      setPickupSettings((current) =>
                        current ? { ...current, pickup_enabled: event.target.checked } : current
                      )
                    }
                  />
                  Enable pickup availability rules
                </label>

                {pickupSettings.pickup_enabled ? (
                  <>
                    <FormField label="Selection Mode">
                      <Select
                        value={pickupSettings.selection_mode}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current ? { ...current, selection_mode: event.target.value as PickupSettings["selection_mode"] } : current
                          )
                        }
                      >
                        <option value="buyer_select">Buyer selects location</option>
                        <option value="hidden_nearest">Auto-select nearest location</option>
                      </Select>
                    </FormField>

                    <FormField label="Eligibility Radius (miles)">
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={pickupSettings.eligibility_radius_miles}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current
                              ? { ...current, eligibility_radius_miles: Number.parseInt(event.target.value || "100", 10) }
                              : current
                          )
                        }
                      />
                    </FormField>

                    <FormField label="No Geolocation Behavior">
                      <Select
                        value={pickupSettings.geolocation_fallback_mode}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  geolocation_fallback_mode: event.target.value as PickupSettings["geolocation_fallback_mode"]
                                }
                              : current
                          )
                        }
                      >
                        <option value="allow_without_distance">Allow pickup without distance checks</option>
                        <option value="disable_pickup">Disable pickup until location is shared</option>
                      </Select>
                    </FormField>

                    <FormField label="Outside Radius Behavior">
                      <Select
                        value={pickupSettings.out_of_radius_behavior}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  out_of_radius_behavior: event.target.value as PickupSettings["out_of_radius_behavior"]
                                }
                              : current
                          )
                        }
                      >
                        <option value="disable_pickup">Disable pickup</option>
                        <option value="allow_all_locations">Allow all pickup locations</option>
                      </Select>
                    </FormField>

                    <FormField label="Lead Time (hours)">
                      <Input
                        type="number"
                        min={0}
                        max={720}
                        value={pickupSettings.lead_time_hours}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current ? { ...current, lead_time_hours: Number.parseInt(event.target.value || "48", 10) } : current
                          )
                        }
                      />
                    </FormField>

                    <FormField label="Slot Interval">
                      <Select
                        value={String(pickupSettings.slot_interval_minutes)}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  slot_interval_minutes: Number.parseInt(event.target.value, 10) as PickupSettings["slot_interval_minutes"]
                                }
                              : current
                          )
                        }
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="120">120 minutes</option>
                      </Select>
                    </FormField>

                    <FormField label="Timezone">
                      <Input
                        value={pickupSettings.timezone}
                        onChange={(event) =>
                          setPickupSettings((current) => (current ? { ...current, timezone: event.target.value } : current))
                        }
                      />
                    </FormField>

                    <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={pickupSettings.show_pickup_times}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current ? { ...current, show_pickup_times: event.target.checked } : current
                          )
                        }
                      />
                      Show pickup times to buyers
                    </label>

                    <FormField className="sm:col-span-2" label="Pickup Instructions">
                      <Textarea
                        rows={2}
                        value={pickupSettings.instructions ?? ""}
                        onChange={(event) =>
                          setPickupSettings((current) =>
                            current ? { ...current, instructions: event.target.value } : current
                          )
                        }
                        placeholder="Bring order confirmation and photo ID to pickup."
                      />
                    </FormField>
                  </>
                ) : (
                  <div className="sm:col-span-2 rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
                    Pickup rules are currently off. You can still prepare locations, hours, and blackout windows below before enabling buyer pickup.
                  </div>
                )}

                <div className="sm:col-span-2 mt-2 space-y-3 border-t border-border/60 pt-3">
                      <p className="text-sm font-medium">Pickup Locations</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={newLocationName} onChange={(event) => setNewLocationName(event.target.value)} placeholder="Location name" />
                        <Input value={newLocationAddress} onChange={(event) => setNewLocationAddress(event.target.value)} placeholder="Address line 1" />
                        <Input value={newLocationCity} onChange={(event) => setNewLocationCity(event.target.value)} placeholder="City" />
                        <Input value={newLocationState} onChange={(event) => setNewLocationState(event.target.value)} placeholder="State/Region" />
                        <Input value={newLocationPostal} onChange={(event) => setNewLocationPostal(event.target.value)} placeholder="Postal code" />
                        <Input value={newLocationLat} onChange={(event) => setNewLocationLat(event.target.value)} placeholder="Latitude" />
                        <Input value={newLocationLng} onChange={(event) => setNewLocationLng(event.target.value)} placeholder="Longitude" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void addLocation()}
                        disabled={saving || !newLocationName || !newLocationAddress}
                      >
                        Add pickup location
                      </Button>
                      <ul className="space-y-2">
                        {locations.length === 0 ? <li className="text-sm text-muted-foreground">No pickup locations configured yet.</li> : null}
                        {locations.map((location) => (
                          <li key={location.id} className="flex items-center justify-between gap-3 border border-border/60 px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium">{location.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {location.address_line1}, {location.city}, {location.state_region} {location.postal_code}
                              </p>
                              {(!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) ? (
                                <p className="text-xs text-amber-700">Coordinates missing</p>
                              ) : null}
                              {pickupSettings.show_pickup_times && !hours.some((entry) => entry.pickup_location_id === location.id) ? (
                                <p className="text-xs text-amber-700">Pickup hours missing</p>
                              ) : null}
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void removeLocation(location.id)} disabled={saving}>
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="sm:col-span-2 mt-2 space-y-3 border-t border-border/60 pt-3">
                      <p className="text-sm font-medium">Pickup Schedule</p>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Select
                          value={selectedHoursLocationId}
                          onChange={(event) => {
                            const nextLocationId = event.target.value;
                            setSelectedHoursLocationId(nextLocationId);
                            setHoursDraft(
                              hours
                                .filter((entry) => entry.pickup_location_id === nextLocationId)
                                .map((entry) => ({ dayOfWeek: entry.day_of_week, opensAt: entry.opens_at, closesAt: entry.closes_at }))
                            );
                          }}
                        >
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </Select>
                        <Button type="button" variant="outline" size="sm" onClick={() => void saveHours()} disabled={saving || !selectedHoursLocationId}>
                          Save schedule
                        </Button>
                      </div>
                      {selectedHoursLocationId ? (
                        <div className="space-y-2">
                          {hoursDraft.map((slot, index) => (
                            <div key={`${slot.dayOfWeek}-${slot.opensAt}-${slot.closesAt}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto]">
                              <Select
                                value={String(slot.dayOfWeek)}
                                onChange={(event) =>
                                  setHoursDraft((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, dayOfWeek: Number.parseInt(event.target.value, 10) } : entry
                                    )
                                  )
                                }
                              >
                                {DAY_OPTIONS.map((option) => (
                                  <option key={option.value} value={String(option.value)}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                type="time"
                                value={slot.opensAt}
                                onChange={(event) =>
                                  setHoursDraft((current) =>
                                    current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, opensAt: event.target.value } : entry))
                                  )
                                }
                              />
                              <Input
                                type="time"
                                value={slot.closesAt}
                                onChange={(event) =>
                                  setHoursDraft((current) =>
                                    current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, closesAt: event.target.value } : entry))
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setHoursDraft((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={() => setHoursDraft((current) => [...current, createDefaultScheduleWindow()])}>
                            Add time window
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Add a pickup location first to configure its schedule.</p>
                      )}
                      {selectedHoursLocationId && hoursBySelectedLocation.length === 0 && hoursDraft.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No schedule saved for this location yet.</p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2 mt-2 space-y-3 border-t border-border/60 pt-3">
                      <p className="text-sm font-medium">Pickup Blackout Windows</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select value={blackoutLocationId} onChange={(event) => setBlackoutLocationId(event.target.value)}>
                          <option value="all">All pickup locations</option>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </Select>
                        <Input value={blackoutReason} onChange={(event) => setBlackoutReason(event.target.value)} placeholder="Reason (optional)" />
                        <Input type="datetime-local" value={blackoutStartAt} onChange={(event) => setBlackoutStartAt(event.target.value)} />
                        <Input type="datetime-local" value={blackoutEndAt} onChange={(event) => setBlackoutEndAt(event.target.value)} />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => void addBlackout()} disabled={saving || !blackoutStartAt || !blackoutEndAt}>
                        Add blackout
                      </Button>
                      <ul className="space-y-2">
                        {blackouts.length === 0 ? <li className="text-sm text-muted-foreground">No blackout windows configured.</li> : null}
                        {blackouts.map((blackout) => (
                          <li key={blackout.id} className="flex items-center justify-between gap-2 border border-border/60 px-3 py-2 text-xs">
                            <span>
                              {new Date(blackout.starts_at).toLocaleString()} - {new Date(blackout.ends_at).toLocaleString()}
                              {blackout.reason ? ` (${blackout.reason})` : ""}
                            </span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void removeBlackout(blackout.id)} disabled={saving}>
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
              </div>
              </div>
            </SectionCard>
          </form>
        ) : null}

      </div>

      {!loading && pickupSettings && (hideBuilderOfferSettings || checkoutSettings) ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel={saveLabel}
          savePendingLabel="Saving..."
          savePending={saving}
          saveDisabled={!isDirty || saving}
          discardDisabled={!isDirty || saving}
          statusMessage={error}
          statusVariant="error"
        />
      ) : null}
    </section>
  );
}
