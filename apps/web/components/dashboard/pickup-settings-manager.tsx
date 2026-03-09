"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
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

type PickupSettingsManagerProps = {
  header?: ReactNode;
};

export function PickupSettingsManager({ header }: PickupSettingsManagerProps) {
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
      checkoutSettings &&
      savedCheckoutSettings &&
      (JSON.stringify(pickupSettings) !== JSON.stringify(savedPickupSettings) ||
        JSON.stringify(checkoutSettings) !== JSON.stringify(savedCheckoutSettings))
  );

  async function loadData() {
    setLoading(true);
    setError(null);

    const [settingsResponse, pickupResponse, locationsResponse, hoursResponse, blackoutsResponse] = await Promise.all([
      fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/settings", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/locations", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/hours", storeSlug), { cache: "no-store" }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/blackouts", storeSlug), { cache: "no-store" })
    ]);

    const settingsPayload = (await settingsResponse.json()) as {
      settings?: {
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

    const resolvedCheckout: CheckoutPickupSettings = {
      checkout_enable_local_pickup: settingsPayload.settings?.checkout_enable_local_pickup ?? false,
      checkout_local_pickup_label: settingsPayload.settings?.checkout_local_pickup_label ?? "Local pickup",
      checkout_local_pickup_fee_cents: settingsPayload.settings?.checkout_local_pickup_fee_cents ?? 0
    };

    setCheckoutSettings(resolvedCheckout);
    setSavedCheckoutSettings(resolvedCheckout);

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
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [storeSlug]);

  function resetCoreChanges() {
    if (!savedPickupSettings || !savedCheckoutSettings) {
      return;
    }

    setPickupSettings(savedPickupSettings);
    setCheckoutSettings(savedCheckoutSettings);
    setError(null);
  }

  async function saveCoreConfig() {
    if (!pickupSettings || !checkoutSettings) {
      return;
    }

    const localPickupFeeCents = Number.parseInt(String(checkoutSettings.checkout_local_pickup_fee_cents ?? 0), 10);

    if (!Number.isInteger(localPickupFeeCents) || localPickupFeeCents < 0) {
      setError("Pickup fee must be a non-negative integer amount in cents.");
      return;
    }

    setSaving(true);
    setError(null);

    const [settingsResponse, pickupResponse] = await Promise.all([
      fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutEnableLocalPickup: checkoutSettings.checkout_enable_local_pickup,
          checkoutLocalPickupLabel: checkoutSettings.checkout_local_pickup_label?.trim() || null,
          checkoutLocalPickupFeeCents: localPickupFeeCents
        })
      }),
      fetch(buildStoreScopedApiPath("/api/stores/pickup/settings", storeSlug), {
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
      })
    ]);

    const settingsPayload = (await settingsResponse.json()) as {
      settings?: {
        checkout_enable_local_pickup?: boolean;
        checkout_local_pickup_label?: string | null;
        checkout_local_pickup_fee_cents?: number;
      };
      error?: string;
    };
    const pickupPayload = (await pickupResponse.json()) as { settings?: PickupSettings; error?: string };

    if (!settingsResponse.ok) {
      setError(settingsPayload.error ?? "Unable to save pickup checkout settings.");
      setSaving(false);
      return;
    }

    if (!pickupResponse.ok) {
      setError(pickupPayload.error ?? "Unable to save pickup settings.");
      setSaving(false);
      return;
    }

    const nextCheckout: CheckoutPickupSettings = {
      checkout_enable_local_pickup: settingsPayload.settings?.checkout_enable_local_pickup ?? checkoutSettings.checkout_enable_local_pickup,
      checkout_local_pickup_label: settingsPayload.settings?.checkout_local_pickup_label ?? checkoutSettings.checkout_local_pickup_label,
      checkout_local_pickup_fee_cents: settingsPayload.settings?.checkout_local_pickup_fee_cents ?? checkoutSettings.checkout_local_pickup_fee_cents
    };

    const nextPickup = pickupPayload.settings ?? pickupSettings;

    setCheckoutSettings(nextCheckout);
    setSavedCheckoutSettings(nextCheckout);
    setPickupSettings(nextPickup);
    setSavedPickupSettings(nextPickup);
    setSaving(false);
    notify.success("Pickup settings saved.");
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

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading pickup settings...</p> : null}

        {!loading && pickupSettings && checkoutSettings ? (
          <form id={formId} className="space-y-4" onSubmit={handleCoreConfigSubmit}>
            <SectionCard
              title="Local Pickup"
              description="Configure pickup availability, buyer rules, locations, schedule, and blackout windows."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checkoutSettings.checkout_enable_local_pickup}
                    onChange={(event) =>
                      setCheckoutSettings((current) =>
                        current ? { ...current, checkout_enable_local_pickup: event.target.checked } : current
                      )
                    }
                  />
                  Enable local pickup option
                </label>

                {checkoutSettings.checkout_enable_local_pickup ? (
                  <>
                    <FormField label="Pickup Label">
                      <Input
                        value={checkoutSettings.checkout_local_pickup_label ?? ""}
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
                        value={checkoutSettings.checkout_local_pickup_fee_cents}
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

                    <div className="sm:col-span-2 mt-2 space-y-3 border-t border-border/60 pt-3">
                      <p className="text-sm font-medium">Pickup Locations</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={newLocationName} onChange={(event) => setNewLocationName(event.target.value)} placeholder="Location name" />
                        <Input value={newLocationAddress} onChange={(event) => setNewLocationAddress(event.target.value)} placeholder="Address line 1" />
                        <Input value={newLocationCity} onChange={(event) => setNewLocationCity(event.target.value)} placeholder="City" />
                        <Input value={newLocationState} onChange={(event) => setNewLocationState(event.target.value)} placeholder="State/Region" />
                        <Input value={newLocationPostal} onChange={(event) => setNewLocationPostal(event.target.value)} placeholder="Postal code" />
                        <Input value={newLocationLat} onChange={(event) => setNewLocationLat(event.target.value)} placeholder="Latitude (optional)" />
                        <Input value={newLocationLng} onChange={(event) => setNewLocationLng(event.target.value)} placeholder="Longitude (optional)" />
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
                  </>
                ) : null}
              </div>
            </SectionCard>
          </form>
        ) : null}

      </div>

      {!loading && pickupSettings && checkoutSettings ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save pickup settings"
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
