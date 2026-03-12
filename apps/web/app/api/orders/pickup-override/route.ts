import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendOrderPickupUpdatedNotification } from "@/lib/notifications/order-emails";
import { buildPickupSlots } from "@/lib/pickup/scheduling";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const payloadSchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().min(1).max(500)
});

const querySchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().uuid().optional()
});

const orderSelect =
  "id,customer_email,subtotal_cents,total_cents,status,fulfillment_method,fulfillment_label,fulfillment_status,pickup_location_id,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone,discount_cents,promo_code,carrier,tracking_number,tracking_url,shipment_status,created_at,order_fee_breakdowns(platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,plan_key)";

type PickupSettingsRow = {
  pickup_enabled: boolean;
  selection_mode: "buyer_select" | "hidden_nearest";
  lead_time_hours: number;
  slot_interval_minutes: number;
  show_pickup_times: boolean;
  timezone: string;
};

type PickupLocationRow = {
  id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
  is_active: boolean;
};

type PickupHoursRow = {
  pickup_location_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

type PickupBlackoutRow = {
  pickup_location_id: string | null;
  starts_at: string;
  ends_at: string;
};

type PickupOrderRow = {
  id: string;
  store_id: string;
  fulfillment_method: "pickup" | "shipping" | null;
  fulfillment_status: "pending_fulfillment" | "packing" | "shipped" | "delivered";
  pickup_location_id: string | null;
  pickup_location_snapshot_json: Record<string, unknown> | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
};

function buildPickupSnapshot(location: PickupLocationRow) {
  return {
    id: location.id,
    name: location.name,
    addressLine1: location.address_line1,
    addressLine2: location.address_line2,
    city: location.city,
    stateRegion: location.state_region,
    postalCode: location.postal_code,
    countryCode: location.country_code
  };
}

function formatLocationLabel(location: PickupLocationRow) {
  return [location.name, location.address_line1, `${location.city}, ${location.state_region} ${location.postal_code}`].filter(Boolean).join(" · ");
}

async function requireOwnedBundle() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, bundle: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return { supabase, user, bundle: null, response: NextResponse.json({ error: "No store found for account" }, { status: 404 }) };
  }

  return { supabase, user, bundle, response: null };
}

async function loadPickupOverrideData(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, storeId: string, orderId: string) {
  const [{ data: order, error: orderError }, { data: pickupSettings }, { data: locations }, { data: hours }, { data: blackouts }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,store_id,fulfillment_method,fulfillment_status,pickup_location_id,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .maybeSingle<PickupOrderRow>(),
    supabase
      .from("store_pickup_settings")
      .select("pickup_enabled,selection_mode,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone")
      .eq("store_id", storeId)
      .maybeSingle<PickupSettingsRow>(),
    supabase
      .from("pickup_locations")
      .select("id,name,address_line1,address_line2,city,state_region,postal_code,country_code,is_active")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .returns<PickupLocationRow[]>(),
    supabase
      .from("pickup_location_hours")
      .select("pickup_location_id,day_of_week,opens_at,closes_at,pickup_locations!inner(store_id)")
      .eq("pickup_locations.store_id", storeId)
      .returns<PickupHoursRow[]>(),
    supabase
      .from("pickup_blackout_dates")
      .select("pickup_location_id,starts_at,ends_at")
      .eq("store_id", storeId)
      .returns<PickupBlackoutRow[]>()
  ]);

  if (orderError) {
    throw new Error(orderError.message);
  }

  return {
    order,
    pickupSettings: pickupSettings ?? null,
    locations: locations ?? [],
    hours: hours ?? [],
    blackouts: blackouts ?? []
  };
}

function buildLocationSlots(locationId: string, pickupSettings: PickupSettingsRow, hours: PickupHoursRow[], blackouts: PickupBlackoutRow[]) {
  const dayHours = hours
    .filter((entry) => entry.pickup_location_id === locationId)
    .reduce<Record<number, Array<{ opensAt: string; closesAt: string }>>>((acc, entry) => {
      const existing = acc[entry.day_of_week] ?? [];
      existing.push({ opensAt: entry.opens_at, closesAt: entry.closes_at });
      acc[entry.day_of_week] = existing;
      return acc;
    }, {});

  if (!pickupSettings.show_pickup_times) {
    return [];
  }

  return buildPickupSlots({
    now: new Date(),
    leadTimeHours: pickupSettings.lead_time_hours,
    slotIntervalMinutes: pickupSettings.slot_interval_minutes,
    timezone: pickupSettings.timezone,
    dayHours,
    blackoutWindows: blackouts
      .filter((blackout) => blackout.pickup_location_id === null || blackout.pickup_location_id === locationId)
      .map((blackout) => ({
        startsAt: new Date(blackout.starts_at),
        endsAt: new Date(blackout.ends_at)
      })),
    maxSlots: 20
  });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pickup override request." }, { status: 400 });
  }

  const auth = await requireOwnedBundle();
  if (auth.response || !auth.bundle) {
    return auth.response!;
  }

  const { supabase, bundle } = auth;

  const data = await loadPickupOverrideData(supabase, bundle.store.id, parsed.data.orderId);
  if (!data.order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (data.order.fulfillment_method !== "pickup") {
    return NextResponse.json({ error: "Only pickup orders can be rescheduled." }, { status: 400 });
  }

  if (data.order.fulfillment_status === "delivered") {
    return NextResponse.json({ error: "Delivered pickup orders cannot be changed." }, { status: 400 });
  }

  if (!data.pickupSettings?.pickup_enabled) {
    return NextResponse.json({ error: "Pickup availability is not enabled for this store." }, { status: 409 });
  }

  const selectedLocationId = parsed.data.locationId ?? data.order.pickup_location_id ?? data.locations[0]?.id ?? null;
  const selectedLocation = selectedLocationId ? data.locations.find((location) => location.id === selectedLocationId) ?? null : null;
  const slots = selectedLocation ? buildLocationSlots(selectedLocation.id, data.pickupSettings, data.hours, data.blackouts) : [];

  return NextResponse.json({
    order: {
      id: data.order.id,
      pickupLocationId: data.order.pickup_location_id,
      pickupWindowStartAt: data.order.pickup_window_start_at,
      pickupWindowEndAt: data.order.pickup_window_end_at,
      pickupTimezone: data.order.pickup_timezone
    },
    pickupSettings: {
      timezone: data.pickupSettings.timezone,
      showPickupTimes: data.pickupSettings.show_pickup_times
    },
    locations: data.locations.map((location) => ({
      id: location.id,
      label: formatLocationLabel(location),
      snapshot: buildPickupSnapshot(location)
    })),
    selectedLocationId,
    slots
  });
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, payloadSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const auth = await requireOwnedBundle();
  if (auth.response || !auth.bundle || !auth.user) {
    return auth.response!;
  }

  const { supabase, bundle, user } = auth;

  const data = await loadPickupOverrideData(supabase, bundle.store.id, payload.data.orderId);
  if (!data.order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (data.order.fulfillment_method !== "pickup") {
    return NextResponse.json({ error: "Only pickup orders can be rescheduled." }, { status: 400 });
  }

  if (data.order.fulfillment_status === "delivered") {
    return NextResponse.json({ error: "Delivered pickup orders cannot be changed." }, { status: 400 });
  }

  if (!data.pickupSettings?.pickup_enabled) {
    return NextResponse.json({ error: "Pickup availability is not enabled for this store." }, { status: 409 });
  }

  const location = data.locations.find((entry) => entry.id === payload.data.locationId);
  if (!location) {
    return NextResponse.json({ error: "Pickup location is unavailable." }, { status: 404 });
  }

  const availableSlots = buildLocationSlots(location.id, data.pickupSettings, data.hours, data.blackouts);
  const matchingSlot = availableSlots.find((slot) => slot.startsAt === payload.data.startsAt && slot.endsAt === payload.data.endsAt);
  if (!matchingSlot) {
    return NextResponse.json({ error: "Pickup slot is no longer available." }, { status: 409 });
  }

  const nextSnapshot = buildPickupSnapshot(location);

  const { data: order, error: updateError } = await supabase
    .from("orders")
    .update({
      pickup_location_id: location.id,
      pickup_location_snapshot_json: nextSnapshot,
      pickup_window_start_at: payload.data.startsAt,
      pickup_window_end_at: payload.data.endsAt,
      pickup_timezone: data.pickupSettings.timezone
    })
    .eq("id", data.order.id)
    .eq("store_id", bundle.store.id)
    .select(orderSelect)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "pickup_override",
    entity: "order",
    entityId: data.order.id,
    metadata: {
      reason: payload.data.reason,
      previousPickup: {
        locationId: data.order.pickup_location_id,
        locationSnapshot: data.order.pickup_location_snapshot_json,
        windowStartAt: data.order.pickup_window_start_at,
        windowEndAt: data.order.pickup_window_end_at,
        timezone: data.order.pickup_timezone
      },
      nextPickup: {
        locationId: location.id,
        locationSnapshot: nextSnapshot,
        windowStartAt: payload.data.startsAt,
        windowEndAt: payload.data.endsAt,
        timezone: data.pickupSettings.timezone
      }
    }
  });

  await sendOrderPickupUpdatedNotification(data.order.id, {
    reason: payload.data.reason,
    previousPickup: {
      fulfillmentMethod: "pickup",
      pickupLocationSnapshot: data.order.pickup_location_snapshot_json,
      pickupWindowStartAt: data.order.pickup_window_start_at,
      pickupWindowEndAt: data.order.pickup_window_end_at,
      pickupTimezone: data.order.pickup_timezone
    }
  });

  return NextResponse.json({ order });
}
