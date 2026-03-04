"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type PickupSettings = {
  pickup_enabled: boolean;
  selection_mode: "buyer_select" | "hidden_nearest";
  eligibility_radius_miles: number;
  lead_time_hours: number;
  slot_interval_minutes: 15 | 30 | 60 | 120;
  show_pickup_times: boolean;
  timezone: string;
  instructions: string | null;
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

export function PickupSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PickupSettings | null>(null);
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [hours, setHours] = useState<PickupHoursRow[]>([]);
  const [blackouts, setBlackouts] = useState<PickupBlackoutRow[]>([]);
  const [hoursLocationId, setHoursLocationId] = useState<string>("");
  const [hoursText, setHoursText] = useState<string>("[]");
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

  async function loadData() {
    setLoading(true);
    setError(null);

    const [settingsResponse, locationsResponse, hoursResponse, blackoutsResponse] = await Promise.all([
      fetch("/api/stores/pickup/settings", { cache: "no-store" }),
      fetch("/api/stores/pickup/locations", { cache: "no-store" }),
      fetch("/api/stores/pickup/hours", { cache: "no-store" }),
      fetch("/api/stores/pickup/blackouts", { cache: "no-store" })
    ]);

    const settingsPayload = (await settingsResponse.json()) as { settings?: PickupSettings; error?: string };
    const locationsPayload = (await locationsResponse.json()) as { locations?: PickupLocation[]; error?: string };
    const hoursPayload = (await hoursResponse.json()) as { hours?: PickupHoursRow[]; error?: string };
    const blackoutsPayload = (await blackoutsResponse.json()) as { blackouts?: PickupBlackoutRow[]; error?: string };

    if (!settingsResponse.ok) {
      setError(settingsPayload.error ?? "Unable to load pickup settings.");
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

    setSettings(settingsPayload.settings ?? null);
    const nextLocations = locationsPayload.locations ?? [];
    setLocations(nextLocations);
    setHours(hoursPayload.hours ?? []);
    setBlackouts(blackoutsPayload.blackouts ?? []);
    const defaultLocationId = nextLocations[0]?.id ?? "";
    setHoursLocationId(defaultLocationId);
    const locationHours = (hoursPayload.hours ?? []).filter((row) => row.pickup_location_id === defaultLocationId);
    setHoursText(
      JSON.stringify(
        locationHours.map((row) => ({
          dayOfWeek: row.day_of_week,
          opensAt: row.opens_at,
          closesAt: row.closes_at
        })),
        null,
        2
      )
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveSettings() {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/pickup/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupEnabled: settings.pickup_enabled,
        selectionMode: settings.selection_mode,
        eligibilityRadiusMiles: settings.eligibility_radius_miles,
        leadTimeHours: settings.lead_time_hours,
        slotIntervalMinutes: settings.slot_interval_minutes,
        showPickupTimes: settings.show_pickup_times,
        timezone: settings.timezone,
        instructions: settings.instructions
      })
    });

    const payload = (await response.json()) as { settings?: PickupSettings; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to save pickup settings.");
      setSaving(false);
      return;
    }

    setSettings(payload.settings ?? settings);
    setSaving(false);
  }

  async function addLocation() {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/pickup/locations", {
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
  }

  async function removeLocation(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/stores/pickup/locations/${id}`, { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to remove pickup location.");
      setSaving(false);
      return;
    }

    setLocations((current) => current.filter((entry) => entry.id !== id));
    setSaving(false);
  }

  async function saveHours() {
    if (!hoursLocationId) {
      setError("Select a pickup location before saving hours.");
      return;
    }

    setSaving(true);
    setError(null);

    let parsedHours: Array<{ dayOfWeek: number; opensAt: string; closesAt: string }> = [];
    try {
      const parsed = JSON.parse(hoursText) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("Hours payload must be an array.");
      }
      parsedHours = parsed as Array<{ dayOfWeek: number; opensAt: string; closesAt: string }>;
    } catch (parseError) {
      setSaving(false);
      setError(parseError instanceof Error ? parseError.message : "Pickup hours JSON is invalid.");
      return;
    }

    const response = await fetch("/api/stores/pickup/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: hoursLocationId,
        hours: parsedHours
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
  }

  async function addBlackout() {
    if (!blackoutStartAt || !blackoutEndAt) {
      setError("Select blackout start and end times.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/stores/pickup/blackouts", {
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
  }

  async function removeBlackout(id: string) {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/stores/pickup/blackouts/${id}`, { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to remove blackout.");
      setSaving(false);
      return;
    }

    setBlackouts((current) => current.filter((entry) => entry.id !== id));
    setSaving(false);
  }

  return (
    <SectionCard
      title="Pickup Locations & Rules"
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => void saveSettings()} disabled={saving || loading || !settings}>
          {saving ? "Saving..." : "Save pickup config"}
        </Button>
      }
    >
      {loading ? <p className="text-sm text-muted-foreground">Loading pickup configuration...</p> : null}
      {settings ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Pickup Enabled" description="Turn pickup on or off for checkout.">
            <Select
              value={settings.pickup_enabled ? "true" : "false"}
              onChange={(event) => setSettings((current) => (current ? { ...current, pickup_enabled: event.target.value === "true" } : current))}
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </Select>
          </FormField>
          <FormField label="Selection Mode" description="Hide options and auto-select nearest, or allow buyer choice.">
            <Select
              value={settings.selection_mode}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, selection_mode: event.target.value as "buyer_select" | "hidden_nearest" } : current
                )
              }
            >
              <option value="buyer_select">Buyer selects</option>
              <option value="hidden_nearest">Hidden nearest</option>
            </Select>
          </FormField>
          <FormField label="Eligibility Radius (miles)" description="Hide pickup if buyer is outside this radius.">
            <Input
              type="number"
              min={1}
              max={1000}
              value={settings.eligibility_radius_miles}
              onChange={(event) =>
                setSettings((current) => (current ? { ...current, eligibility_radius_miles: Number.parseInt(event.target.value || "100", 10) } : current))
              }
            />
          </FormField>
          <FormField label="Lead Time (hours)" description="Minimum prep time before the first available slot.">
            <Input
              type="number"
              min={0}
              max={720}
              value={settings.lead_time_hours}
              onChange={(event) =>
                setSettings((current) => (current ? { ...current, lead_time_hours: Number.parseInt(event.target.value || "48", 10) } : current))
              }
            />
          </FormField>
          <FormField label="Slot Interval" description="Time slot duration shown to buyers.">
            <Select
              value={String(settings.slot_interval_minutes)}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        slot_interval_minutes: Number.parseInt(event.target.value, 10) as 15 | 30 | 60 | 120
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
          <FormField label="Timezone" description="Used for pickup slot display and order confirmations.">
            <Input value={settings.timezone} onChange={(event) => setSettings((current) => (current ? { ...current, timezone: event.target.value } : current))} />
          </FormField>
          <FormField label="Instructions" className="sm:col-span-2" description="Shown in checkout and confirmation email.">
            <Input
              value={settings.instructions ?? ""}
              onChange={(event) => setSettings((current) => (current ? { ...current, instructions: event.target.value } : current))}
              placeholder="Bring order confirmation and photo ID to pickup."
            />
          </FormField>
        </div>
      ) : null}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
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
        <Button type="button" variant="outline" size="sm" onClick={() => void addLocation()} disabled={saving || !newLocationName || !newLocationAddress}>
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

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium">Pickup Hours (per location)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={hoursLocationId}
            onChange={(event) => {
              const nextLocationId = event.target.value;
              setHoursLocationId(nextLocationId);
              const nextHours = hours.filter((row) => row.pickup_location_id === nextLocationId);
              setHoursText(
                JSON.stringify(
                  nextHours.map((row) => ({
                    dayOfWeek: row.day_of_week,
                    opensAt: row.opens_at,
                    closesAt: row.closes_at
                  })),
                  null,
                  2
                )
              );
            }}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => void saveHours()} disabled={saving || !hoursLocationId}>
            Save hours JSON
          </Button>
        </div>
        <Textarea
          rows={8}
          value={hoursText}
          onChange={(event) => setHoursText(event.target.value)}
          placeholder='[{"dayOfWeek":1,"opensAt":"09:00","closesAt":"17:00"}]'
        />
        <p className="text-xs text-muted-foreground">
          Format: JSON array of objects with `dayOfWeek` (0-6), `opensAt` and `closesAt` in 24h `HH:MM`.
        </p>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
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
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </SectionCard>
  );
}
