import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  pickupEnabled: z.boolean(),
  selectionMode: z.enum(["buyer_select", "hidden_nearest"]),
  geolocationFallbackMode: z.enum(["allow_without_distance", "disable_pickup"]),
  outOfRadiusBehavior: z.enum(["disable_pickup", "allow_all_locations"]),
  eligibilityRadiusMiles: z.number().int().min(1).max(1000),
  leadTimeHours: z.number().int().min(0).max(720),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]),
  showPickupTimes: z.boolean(),
  timezone: z.string().trim().min(2).max(60),
  instructions: z.string().trim().max(2000).nullable().optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireStoreRole("staff", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("store_pickup_settings")
    .select(
      "store_id,pickup_enabled,selection_mode,geolocation_fallback_mode,out_of_radius_behavior,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone,instructions"
    )
    .eq("store_id", auth.context.storeId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      settings: {
        pickup_enabled: false,
        selection_mode: "buyer_select",
        geolocation_fallback_mode: "allow_without_distance",
        out_of_radius_behavior: "disable_pickup",
        eligibility_radius_miles: 100,
        lead_time_hours: 48,
        slot_interval_minutes: 60,
        show_pickup_times: true,
        timezone: "America/New_York",
        instructions: null
      }
    });
  }

  return NextResponse.json({ settings: data });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("staff", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseJsonRequest(request, updateSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("store_pickup_settings")
    .upsert(
      {
        store_id: auth.context.storeId,
        pickup_enabled: payload.data.pickupEnabled,
        selection_mode: payload.data.selectionMode,
        geolocation_fallback_mode: payload.data.geolocationFallbackMode,
        out_of_radius_behavior: payload.data.outOfRadiusBehavior,
        eligibility_radius_miles: payload.data.eligibilityRadiusMiles,
        lead_time_hours: payload.data.leadTimeHours,
        slot_interval_minutes: payload.data.slotIntervalMinutes,
        show_pickup_times: payload.data.showPickupTimes,
        timezone: payload.data.timezone,
        instructions: payload.data.instructions ?? null
      },
      { onConflict: "store_id" }
    )
    .select(
      "store_id,pickup_enabled,selection_mode,geolocation_fallback_mode,out_of_radius_behavior,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone,instructions"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
