import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  pickupEnabled: z.boolean(),
  selectionMode: z.enum(["buyer_select", "hidden_nearest"]),
  eligibilityRadiusMiles: z.number().int().min(1).max(1000),
  leadTimeHours: z.number().int().min(0).max(720),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]),
  showPickupTimes: z.boolean(),
  timezone: z.string().trim().min(2).max(60),
  instructions: z.string().trim().max(2000).nullable().optional()
});

export async function GET() {
  const auth = await requireStoreRole("staff");
  if (auth.response || !auth.context) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("store_pickup_settings")
    .select("store_id,pickup_enabled,selection_mode,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone,instructions")
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

  const auth = await requireStoreRole("staff");
  if (auth.response || !auth.context) {
    return auth.response;
  }

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("store_pickup_settings")
    .upsert(
      {
        store_id: auth.context.storeId,
        pickup_enabled: payload.data.pickupEnabled,
        selection_mode: payload.data.selectionMode,
        eligibility_radius_miles: payload.data.eligibilityRadiusMiles,
        lead_time_hours: payload.data.leadTimeHours,
        slot_interval_minutes: payload.data.slotIntervalMinutes,
        show_pickup_times: payload.data.showPickupTimes,
        timezone: payload.data.timezone,
        instructions: payload.data.instructions ?? null
      },
      { onConflict: "store_id" }
    )
    .select("store_id,pickup_enabled,selection_mode,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone,instructions")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
