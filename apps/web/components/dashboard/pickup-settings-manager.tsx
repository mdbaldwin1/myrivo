"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { PickupAddressSuggestion } from "@/lib/pickup/geocode";
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
  address_line2: string | null;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
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

type PickupBlackoutDraft = {
  id?: string;
  localId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

type PickupOptionDraft = {
  localId: string;
  id: string | null;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  notes: string;
  isActive: boolean;
  schedules: PickupScheduleDraft[];
  blackouts: PickupBlackoutDraft[];
  isSaving: boolean;
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

function createDraftId() {
  return `pickup-option-${Math.random().toString(36).slice(2, 10)}`;
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function createPickupOptionDraft(input?: {
  location?: PickupLocation;
  hours?: PickupHoursRow[];
  blackouts?: PickupBlackoutRow[];
}): PickupOptionDraft {
  const location = input?.location;
  return {
    localId: createDraftId(),
    id: location?.id ?? null,
    name: location?.name ?? "",
    addressLine1: location?.address_line1 ?? "",
    addressLine2: location?.address_line2 ?? "",
    city: location?.city ?? "",
    stateRegion: location?.state_region ?? "",
    postalCode: location?.postal_code ?? "",
    countryCode: location?.country_code ?? "US",
    latitude: Number.isFinite(location?.latitude) ? String(location?.latitude) : "",
    longitude: Number.isFinite(location?.longitude) ? String(location?.longitude) : "",
    notes: location?.notes ?? "",
    isActive: location?.is_active ?? true,
    schedules:
      input?.hours?.map((row) => ({
        dayOfWeek: row.day_of_week,
        opensAt: row.opens_at,
        closesAt: row.closes_at
      })) ?? [],
    blackouts:
      input?.blackouts?.map((row) => ({
        id: row.id,
        localId: createDraftId(),
        startsAt: toDateTimeLocalValue(row.starts_at),
        endsAt: toDateTimeLocalValue(row.ends_at),
        reason: row.reason ?? ""
      })) ?? [],
    isSaving: false
  };
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

  const localPickupOff = !hideBuilderOfferSettings && !checkoutSettings?.checkout_enable_local_pickup;

  if (localPickupOff) {
    return issues;
  }

  // When availability rules are off and no locations exist, pickup works as a
  // simple fulfillment option (e.g. "Porch pickup") — no setup required.
  const rulesOff = !pickupSettings.pickup_enabled;

  if (activeLocations.length === 0 && !rulesOff) {
    issues.push({
      severity: "error",
      message: "Add at least one active pickup location before enabling pickup at checkout."
    });
  }

  if (activeLocations.length > 0 && locationsWithCoordinates.length === 0 && !rulesOff) {
    issues.push({
      severity: "error",
      message: "Add latitude and longitude to at least one active pickup location so buyers can qualify for pickup."
    });
  }

  if (pickupSettings.show_pickup_times && activeLocations.length > 0 && locationsWithHours.size === 0) {
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
  const [pickupOptionDrafts, setPickupOptionDrafts] = useState<PickupOptionDraft[]>([]);
  const [pickupAddressSuggestions, setPickupAddressSuggestions] = useState<Record<string, PickupAddressSuggestion[]>>({});
  const [pickupAddressSearchState, setPickupAddressSearchState] = useState<Record<string, "idle" | "loading">>({});
  const pickupOptionSectionRef = useRef<HTMLDivElement | null>(null);

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
    const nextBlackouts = blackoutsPayload.blackouts ?? [];
    setLocations(nextLocations);
    setHours(nextHours);
    setBlackouts(nextBlackouts);
    setPickupOptionDrafts(
      nextLocations.map((location) =>
        createPickupOptionDraft({
          location,
          hours: nextHours.filter((row) => row.pickup_location_id === location.id),
          blackouts: nextBlackouts.filter((row) => row.pickup_location_id === location.id)
        })
      )
    );
    setPickupAddressSuggestions({});
    setPickupAddressSearchState({});

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
                  checkoutEnableLocalPickup: checkoutSettings.checkout_enable_local_pickup,
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
              settingsPayload.settings?.checkout_enable_local_pickup ?? checkoutSettings.checkout_enable_local_pickup,
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

  function updatePickupOptionDraft(localId: string, updater: (draft: PickupOptionDraft) => PickupOptionDraft) {
    setPickupOptionDrafts((current) => current.map((draft) => (draft.localId === localId ? updater(draft) : draft)));
  }

  function addPickupOptionCard() {
    const nextDraft = createPickupOptionDraft();
    setPickupOptionDrafts((current) => [...current, nextDraft]);

    window.setTimeout(() => {
      const element = document.getElementById(nextDraft.localId);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function addPickupScheduleWindow(localId: string) {
    updatePickupOptionDraft(localId, (draft) => ({
      ...draft,
      schedules: [...draft.schedules, createDefaultScheduleWindow()]
    }));
  }

  function addPickupBlackoutWindow(localId: string) {
    updatePickupOptionDraft(localId, (draft) => ({
      ...draft,
      blackouts: [...draft.blackouts, { localId: createDraftId(), startsAt: "", endsAt: "", reason: "" }]
    }));
  }

  async function savePickupOption(localId: string) {
    const draft = pickupOptionDrafts.find((entry) => entry.localId === localId);
    if (!draft) {
      return;
    }

    if (!draft.name.trim() || !draft.addressLine1.trim() || !draft.city.trim() || !draft.stateRegion.trim() || !draft.postalCode.trim()) {
      setError("Pickup options need a name and complete address details before saving.");
      return;
    }

    for (const slot of draft.schedules) {
      if (!/^\d{2}:\d{2}$/.test(slot.opensAt) || !/^\d{2}:\d{2}$/.test(slot.closesAt) || slot.opensAt >= slot.closesAt) {
        setError("Each pickup time window must have valid HH:MM times and opens before closes.");
        return;
      }
    }

    for (const blackout of draft.blackouts) {
      const startsAtIso = toIsoDateTime(blackout.startsAt);
      const endsAtIso = toIsoDateTime(blackout.endsAt);
      if (!startsAtIso || !endsAtIso || startsAtIso >= endsAtIso) {
        setError("Each blackout window needs a valid start and end time.");
        return;
      }
    }

    setError(null);
    updatePickupOptionDraft(localId, (current) => ({ ...current, isSaving: true }));

    try {
      const locationResponse = await fetch(
        buildStoreScopedApiPath(
          draft.id ? `/api/stores/pickup/locations/${draft.id}` : "/api/stores/pickup/locations",
          storeSlug
        ),
        {
          method: draft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            addressLine1: draft.addressLine1.trim(),
            addressLine2: draft.addressLine2.trim() || null,
            city: draft.city.trim(),
            stateRegion: draft.stateRegion.trim(),
            postalCode: draft.postalCode.trim(),
            countryCode: draft.countryCode.trim() || "US",
            latitude: draft.latitude.trim() ? Number.parseFloat(draft.latitude) : null,
            longitude: draft.longitude.trim() ? Number.parseFloat(draft.longitude) : null,
            notes: draft.notes.trim() || null,
            isActive: draft.isActive
          })
        }
      );

      const locationPayload = (await locationResponse.json()) as { location?: PickupLocation; error?: string };
      if (!locationResponse.ok || !locationPayload.location) {
        throw new Error(locationPayload.error ?? "Unable to save pickup option.");
      }

      const locationId = locationPayload.location.id;

      const hoursResponse = await fetch(buildStoreScopedApiPath("/api/stores/pickup/hours", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          hours: draft.schedules
        })
      });

      const hoursPayload = (await hoursResponse.json()) as { error?: string };
      if (!hoursResponse.ok) {
        throw new Error(hoursPayload.error ?? "Unable to save pickup schedule.");
      }

      const existingBlackoutIds = new Set(
        blackouts.filter((entry) => entry.pickup_location_id === locationId).map((entry) => entry.id)
      );
      const nextBlackoutIds = new Set(draft.blackouts.map((entry) => entry.id).filter((entry): entry is string => Boolean(entry)));

      for (const existingBlackoutId of existingBlackoutIds) {
        if (nextBlackoutIds.has(existingBlackoutId)) {
          continue;
        }

        const deleteResponse = await fetch(
          buildStoreScopedApiPath(`/api/stores/pickup/blackouts/${existingBlackoutId}`, storeSlug),
          { method: "DELETE" }
        );
        const deletePayload = (await deleteResponse.json()) as { error?: string };
        if (!deleteResponse.ok) {
          throw new Error(deletePayload.error ?? "Unable to remove blackout window.");
        }
      }

      for (const blackout of draft.blackouts.filter((entry) => !entry.id)) {
        const blackoutResponse = await fetch(buildStoreScopedApiPath("/api/stores/pickup/blackouts", storeSlug), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupLocationId: locationId,
            startsAt: toIsoDateTime(blackout.startsAt),
            endsAt: toIsoDateTime(blackout.endsAt),
            reason: blackout.reason.trim() || null
          })
        });
        const blackoutPayload = (await blackoutResponse.json()) as { error?: string };
        if (!blackoutResponse.ok) {
          throw new Error(blackoutPayload.error ?? "Unable to save blackout window.");
        }
      }

      await loadData();
      notify.success(draft.id ? "Pickup option updated." : "Pickup option added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save pickup option.");
      updatePickupOptionDraft(localId, (current) => ({ ...current, isSaving: false }));
      return;
    }
  }

  async function removePickupOption(localId: string) {
    const draft = pickupOptionDrafts.find((entry) => entry.localId === localId);
    if (!draft) {
      return;
    }

    if (!draft.id) {
      setPickupOptionDrafts((current) => current.filter((entry) => entry.localId !== localId));
      return;
    }

    setError(null);
    updatePickupOptionDraft(localId, (current) => ({ ...current, isSaving: true }));

    const response = await fetch(buildStoreScopedApiPath(`/api/stores/pickup/locations/${draft.id}`, storeSlug), { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to remove pickup option.");
      updatePickupOptionDraft(localId, (current) => ({ ...current, isSaving: false }));
      return;
    }

    await loadData();
    notify.success("Pickup option removed.");
  }

  async function requestPickupAddressSuggestions(localId: string, draft: PickupOptionDraft) {
    const query = draft.addressLine1.trim();
    if (query.length < 4) {
      setPickupAddressSuggestions((current) => ({ ...current, [localId]: [] }));
      setPickupAddressSearchState((current) => ({ ...current, [localId]: "idle" }));
      return;
    }

    setPickupAddressSearchState((current) => ({ ...current, [localId]: "loading" }));

    try {
      const params = new URLSearchParams({
        storeSlug: storeSlug ?? "",
        query
      });

      if (draft.city.trim()) {
        params.set("city", draft.city.trim());
      }
      if (draft.stateRegion.trim()) {
        params.set("stateRegion", draft.stateRegion.trim());
      }
      if (draft.postalCode.trim()) {
        params.set("postalCode", draft.postalCode.trim());
      }
      if (draft.countryCode.trim()) {
        params.set("countryCode", draft.countryCode.trim());
      }

      const response = await fetch(`/api/stores/pickup/address-search?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { suggestions?: PickupAddressSuggestion[] };

      setPickupAddressSuggestions((current) => ({
        ...current,
        [localId]: response.ok ? payload.suggestions ?? [] : []
      }));
    } catch {
      setPickupAddressSuggestions((current) => ({ ...current, [localId]: [] }));
    } finally {
      setPickupAddressSearchState((current) => ({ ...current, [localId]: "idle" }));
    }
  }

  function applyPickupAddressSuggestion(localId: string, suggestion: PickupAddressSuggestion) {
    updatePickupOptionDraft(localId, (current) => ({
      ...current,
      addressLine1: suggestion.addressLine1,
      city: suggestion.city,
      stateRegion: suggestion.stateRegion,
      postalCode: suggestion.postalCode,
      countryCode: suggestion.countryCode,
      latitude: String(suggestion.latitude),
      longitude: String(suggestion.longitude)
    }));
    setPickupAddressSuggestions((current) => ({ ...current, [localId]: [] }));
    setPickupAddressSearchState((current) => ({ ...current, [localId]: "idle" }));
  }
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
  const showPickupOperations = hideBuilderOfferSettings || Boolean(checkoutSettings?.checkout_enable_local_pickup);
  const saveLabel = showShippingOfferSettings ? "Save fulfillment settings" : "Save pickup settings";
  const globalBlackouts = useMemo(() => blackouts.filter((entry) => entry.pickup_location_id === null), [blackouts]);

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

                {showPickupOperations ? (
                  pickupConfigurationIssues.length > 0 ? (
                    <div className="sm:col-span-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
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
                    <div className="sm:col-span-2">
                      <AppAlert
                        variant="success"
                        title="Pickup readiness"
                        message="Pickup has the core pieces needed for checkout: an active location, map coordinates, and pickup hours."
                      />
                    </div>
                  )
                ) : null}

                {showPickupOperations ? (
                  <>
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
                        Pickup rules are off, so checkout will still offer pickup but will not filter locations by buyer distance.
                      </div>
                    )}

                    <div ref={pickupOptionSectionRef} className="sm:col-span-2 mt-2 space-y-3 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Pickup Options</p>
                          <p className="text-sm text-muted-foreground">
                            Each pickup option keeps its location details, schedule, and blackout windows together.
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addPickupOptionCard}>
                          Add Pickup Option
                        </Button>
                      </div>

                      {globalBlackouts.length > 0 ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                          {globalBlackouts.length} store-wide blackout window{globalBlackouts.length === 1 ? "" : "s"} already exist. They still apply to every pickup option.
                        </div>
                      ) : null}

                      {pickupOptionDrafts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No pickup options configured yet.</p>
                      ) : null}

                      {pickupOptionDrafts.map((draft, optionIndex) => (
                        <div key={draft.localId} id={draft.localId} className="space-y-4 rounded-lg border border-border/70 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">Pickup Option {optionIndex + 1}</p>
                              <p className="text-xs text-muted-foreground">
                                {draft.id ? "Saved option" : "New option"}
                                {draft.latitude.trim() && draft.longitude.trim() ? " • Coordinates ready" : " • Coordinates will auto-fill from address on save"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={draft.isSaving} onClick={() => void savePickupOption(draft.localId)}>
                                {draft.isSaving ? "Saving..." : "Save option"}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" disabled={draft.isSaving} onClick={() => void removePickupOption(draft.localId)}>
                                Remove
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="Location name">
                              <Input
                                value={draft.name}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, name: event.target.value }))}
                                placeholder="Main pickup"
                              />
                            </FormField>
                            <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-2">
                              <Checkbox
                                checked={draft.isActive}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, isActive: event.target.checked }))}
                              />
                              Active pickup option
                            </label>
                            <FormField label="Address line 1" className="sm:col-span-2">
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <Input
                                    autoComplete="street-address"
                                    value={draft.addressLine1}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      updatePickupOptionDraft(draft.localId, (current) => ({ ...current, addressLine1: nextValue }));
                                      if (nextValue.trim().length < 4) {
                                        setPickupAddressSuggestions((current) => ({ ...current, [draft.localId]: [] }));
                                        setPickupAddressSearchState((current) => ({ ...current, [draft.localId]: "idle" }));
                                      }
                                    }}
                                    placeholder="123 Main St"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={pickupAddressSearchState[draft.localId] === "loading" || draft.addressLine1.trim().length < 4}
                                    onClick={() => void requestPickupAddressSuggestions(draft.localId, draft)}
                                  >
                                    {pickupAddressSearchState[draft.localId] === "loading" ? "Searching..." : "Find address"}
                                  </Button>
                                </div>
                                {pickupAddressSuggestions[draft.localId]?.length ? (
                                  <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                      Address suggestions
                                    </p>
                                    <div className="space-y-1">
                                      {(pickupAddressSuggestions[draft.localId] ?? []).map((suggestion) => (
                                        <button
                                          key={`${draft.localId}-${suggestion.label}`}
                                          type="button"
                                          className="block w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted"
                                          onClick={() => applyPickupAddressSuggestion(draft.localId, suggestion)}
                                        >
                                          {suggestion.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </FormField>
                            <FormField label="Address line 2" className="sm:col-span-2">
                              <Input
                                autoComplete="address-line2"
                                value={draft.addressLine2}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, addressLine2: event.target.value }))}
                                placeholder="Suite, building, or notes"
                              />
                            </FormField>
                            <FormField label="City">
                              <Input
                                autoComplete="address-level2"
                                value={draft.city}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, city: event.target.value }))}
                                placeholder="Virginia Beach"
                              />
                            </FormField>
                            <FormField label="State / Region">
                              <Input
                                autoComplete="address-level1"
                                value={draft.stateRegion}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, stateRegion: event.target.value }))}
                                placeholder="VA"
                              />
                            </FormField>
                            <FormField label="Postal code">
                              <Input
                                autoComplete="postal-code"
                                value={draft.postalCode}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, postalCode: event.target.value }))}
                                placeholder="23452"
                              />
                            </FormField>
                            <FormField label="Country code">
                              <Input
                                autoComplete="country"
                                value={draft.countryCode}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, countryCode: event.target.value }))}
                                placeholder="US"
                              />
                            </FormField>
                            <FormField label="Latitude">
                              <Input
                                value={draft.latitude}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, latitude: event.target.value }))}
                                placeholder="Auto-filled on save"
                              />
                            </FormField>
                            <FormField label="Longitude">
                              <Input
                                value={draft.longitude}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, longitude: event.target.value }))}
                                placeholder="Auto-filled on save"
                              />
                            </FormField>
                            <FormField className="sm:col-span-2" label="Notes">
                              <Textarea
                                rows={2}
                                value={draft.notes}
                                onChange={(event) => updatePickupOptionDraft(draft.localId, (current) => ({ ...current, notes: event.target.value }))}
                                placeholder="Anything shoppers should know before pickup."
                              />
                            </FormField>
                          </div>

                          <div className="space-y-3 border-t border-border/60 pt-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">Pickup Schedule</p>
                              <Button type="button" variant="outline" size="sm" onClick={() => addPickupScheduleWindow(draft.localId)}>
                                Add time window
                              </Button>
                            </div>
                            {draft.schedules.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No pickup hours yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {draft.schedules.map((slot, index) => (
                                  <div key={`${draft.localId}-schedule-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto]">
                                    <Select
                                      value={String(slot.dayOfWeek)}
                                      onChange={(event) =>
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          schedules: current.schedules.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, dayOfWeek: Number.parseInt(event.target.value, 10) } : entry
                                          )
                                        }))
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
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          schedules: current.schedules.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, opensAt: event.target.value } : entry
                                          )
                                        }))
                                      }
                                    />
                                    <Input
                                      type="time"
                                      value={slot.closesAt}
                                      onChange={(event) =>
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          schedules: current.schedules.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, closesAt: event.target.value } : entry
                                          )
                                        }))
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          schedules: current.schedules.filter((_, entryIndex) => entryIndex !== index)
                                        }))
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 border-t border-border/60 pt-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">Blackout Windows</p>
                              <Button type="button" variant="outline" size="sm" onClick={() => addPickupBlackoutWindow(draft.localId)}>
                                Add blackout
                              </Button>
                            </div>
                            {draft.blackouts.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No blackout windows yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {draft.blackouts.map((blackout, index) => (
                                  <div key={blackout.localId} className="grid gap-2 sm:grid-cols-2">
                                    <Input
                                      type="datetime-local"
                                      value={blackout.startsAt}
                                      onChange={(event) =>
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          blackouts: current.blackouts.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, startsAt: event.target.value } : entry
                                          )
                                        }))
                                      }
                                    />
                                    <Input
                                      type="datetime-local"
                                      value={blackout.endsAt}
                                      onChange={(event) =>
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          blackouts: current.blackouts.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, endsAt: event.target.value } : entry
                                          )
                                        }))
                                      }
                                    />
                                    <Input
                                      className="sm:col-span-2"
                                      value={blackout.reason}
                                      onChange={(event) =>
                                        updatePickupOptionDraft(draft.localId, (current) => ({
                                          ...current,
                                          blackouts: current.blackouts.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, reason: event.target.value } : entry
                                          )
                                        }))
                                      }
                                      placeholder="Reason (optional)"
                                    />
                                    <div className="sm:col-span-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updatePickupOptionDraft(draft.localId, (current) => ({
                                            ...current,
                                            blackouts: current.blackouts.filter((_, entryIndex) => entryIndex !== index)
                                          }))
                                        }
                                      >
                                        Remove blackout
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
                    Enable the local pickup option above to show pickup setup here.
                  </div>
                )}
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
