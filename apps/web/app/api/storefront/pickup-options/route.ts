import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveAvailablePickupLocations } from "@/lib/pickup/availability";
import { buildPickupSlots } from "@/lib/pickup/scheduling";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  buyerLatitude: z.number().min(-90).max(90).nullable().optional(),
  buyerLongitude: z.number().min(-180).max(180).nullable().optional(),
  locationId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }
  const payload = payloadSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .eq("status", "active")
    .maybeSingle<{ id: string; status: string }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const [{ data: pickupSettings }, { data: locations }, { data: locationHours }, { data: blackouts }] = await Promise.all([
    admin
      .from("store_pickup_settings")
      .select(
        "pickup_enabled,selection_mode,geolocation_fallback_mode,out_of_radius_behavior,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone,instructions"
      )
      .eq("store_id", store.id)
      .maybeSingle<{
        pickup_enabled: boolean;
        selection_mode: "buyer_select" | "hidden_nearest";
        geolocation_fallback_mode: "allow_without_distance" | "disable_pickup";
        out_of_radius_behavior: "disable_pickup" | "allow_all_locations";
        eligibility_radius_miles: number;
        lead_time_hours: number;
        slot_interval_minutes: number;
        show_pickup_times: boolean;
        timezone: string;
        instructions: string | null;
      }>(),
    admin
      .from("pickup_locations")
      .select("id,name,address_line1,address_line2,city,state_region,postal_code,country_code,latitude,longitude,is_active")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .returns<
        Array<{
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
          is_active: boolean;
        }>
      >(),
    admin
      .from("pickup_location_hours")
      .select("pickup_location_id,day_of_week,opens_at,closes_at")
      .returns<Array<{ pickup_location_id: string; day_of_week: number; opens_at: string; closes_at: string }>>(),
    admin
      .from("pickup_blackout_dates")
      .select("pickup_location_id,starts_at,ends_at")
      .eq("store_id", store.id)
      .returns<Array<{ pickup_location_id: string | null; starts_at: string; ends_at: string }>>()
  ]);

  if (!pickupSettings?.pickup_enabled) {
    return NextResponse.json({
      pickupEnabled: false,
      options: [],
      selectedLocationId: null,
      slots: [],
      reason: "Pickup is currently unavailable."
    });
  }

  const buyer =
    payload.data.buyerLatitude !== null && payload.data.buyerLongitude !== null
      ? {
          latitude: payload.data.buyerLatitude ?? NaN,
          longitude: payload.data.buyerLongitude ?? NaN
        }
      : null;

  const normalizedLocations = (locations ?? []).map((location) => ({
    id: location.id,
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude
  }));
  const availableCandidates = resolveAvailablePickupLocations({
    buyer,
    locations: normalizedLocations,
    radiusMiles: pickupSettings.eligibility_radius_miles,
    geolocationFallbackMode: pickupSettings.geolocation_fallback_mode,
    outOfRadiusBehavior: pickupSettings.out_of_radius_behavior
  });

  if (availableCandidates.length === 0) {
    const reason =
      buyer || pickupSettings.geolocation_fallback_mode === "disable_pickup"
        ? `No pickup locations found within ${pickupSettings.eligibility_radius_miles} miles.`
        : "Enable location sharing to verify pickup availability.";
    return NextResponse.json({
      pickupEnabled: false,
      selectionMode: pickupSettings.selection_mode,
      options: [],
      selectedLocationId: null,
      slots: [],
      reason
    });
  }

  const defaultLocationId =
    pickupSettings.selection_mode === "hidden_nearest"
      ? availableCandidates[0]?.id ?? null
      : payload.data.locationId && availableCandidates.some((location) => location.id === payload.data.locationId)
        ? payload.data.locationId
        : availableCandidates[0]?.id ?? null;

  const selectedLocation = (locations ?? []).find((location) => location.id === defaultLocationId);

  const dayHours = (locationHours ?? [])
    .filter((entry) => entry.pickup_location_id === defaultLocationId)
    .reduce<Record<number, Array<{ opensAt: string; closesAt: string }>>>((acc, entry) => {
      const existing = acc[entry.day_of_week] ?? [];
      existing.push({ opensAt: entry.opens_at, closesAt: entry.closes_at });
      acc[entry.day_of_week] = existing;
      return acc;
    }, {});

  const slots =
    pickupSettings.show_pickup_times && defaultLocationId
      ? buildPickupSlots({
          now: new Date(),
          leadTimeHours: pickupSettings.lead_time_hours,
          slotIntervalMinutes: pickupSettings.slot_interval_minutes,
          timezone: pickupSettings.timezone,
          dayHours,
          blackoutWindows: (blackouts ?? [])
            .filter((blackout) => blackout.pickup_location_id === null || blackout.pickup_location_id === defaultLocationId)
            .map((blackout) => ({ startsAt: new Date(blackout.starts_at), endsAt: new Date(blackout.ends_at) })),
          maxSlots: 20
        })
      : [];

  return NextResponse.json({
    pickupEnabled: true,
    selectionMode: pickupSettings.selection_mode,
    radiusMiles: pickupSettings.eligibility_radius_miles,
    instructions: pickupSettings.instructions,
    showPickupTimes: pickupSettings.show_pickup_times,
    timezone: pickupSettings.timezone,
    options: availableCandidates.map((entry) => {
      const location = (locations ?? []).find((item) => item.id === entry.id);
      return {
        id: entry.id,
        name: entry.name,
        distanceMiles: entry.distanceMiles,
        addressLine1: location?.address_line1 ?? "",
        addressLine2: location?.address_line2 ?? null,
        city: location?.city ?? "",
        stateRegion: location?.state_region ?? "",
        postalCode: location?.postal_code ?? "",
        countryCode: location?.country_code ?? "US"
      };
    }),
    selectedLocationId: defaultLocationId,
    selectedLocation,
    slots
  });
}
